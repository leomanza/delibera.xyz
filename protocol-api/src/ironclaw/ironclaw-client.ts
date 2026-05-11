import type { IronClawJobStatus } from './types';

function baseUrl(webhookUrl: string): string {
  return webhookUrl.replace(/\/webhook$/, '');
}

export async function dispatchTask(
  webhookUrl: string,
  webhookSecret: string,
  payload: { taskId: string; proposalId: string; metadata: Record<string, unknown> },
): Promise<string> {
  const message = `deliberate task_id:${payload.taskId} proposal_id:${payload.proposalId}`;
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhookSecret },
    body: JSON.stringify({ user_id: 'coordinator', message, metadata: payload.metadata }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IronClaw dispatch failed (${res.status}): ${err}`);
  }
  const data = await res.json() as { job_id: string };
  return data.job_id;
}

export async function pollJobStatus(
  webhookUrl: string,
  webhookSecret: string,
  jobId: string,
  timeoutMs = 300_000,
): Promise<IronClawJobStatus> {
  const base = baseUrl(webhookUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/jobs/${jobId}`, {
      headers: { 'X-Webhook-Secret': webhookSecret },
    });
    if (res.ok) {
      const job = await res.json() as IronClawJobStatus;
      if (job.status === 'completed' || job.status === 'failed') return job;
    }
    await new Promise(r => setTimeout(r, 5_000));
  }
  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

export async function probeWebhook(webhookUrl: string, webhookSecret: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhookSecret },
      body: JSON.stringify({ user_id: 'probe', message: 'ping' }),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
