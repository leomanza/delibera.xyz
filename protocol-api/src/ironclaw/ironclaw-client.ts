import * as crypto from 'crypto';

/**
 * IronClaw v0.28.1 webhook client.
 *
 * Auth: HMAC-SHA256 signature in `X-Hub-Signature-256` header (GitHub-style).
 *   Signature = "sha256=" + hex(HMAC_SHA256(secret, raw_body))
 *
 * Payload: { user_id, content, conversation_id?, metadata? }
 *   Note: v0.28.1 uses `content`, NOT `message` (older docs say `message`).
 *
 * Response: { message_id, status: "accepted", response: null }
 *   Status polling endpoints (`GET /jobs/{id}`) were removed in v0.28.1.
 *   This is fire-and-forget — completion is signaled via Ensue writes by the worker.
 */

function signBody(secret: string, rawBody: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  return 'sha256=' + hmac.digest('hex');
}

export async function dispatchTask(
  webhookUrl: string,
  webhookSecret: string,
  payload: { taskId: string; proposalId: string; metadata: Record<string, unknown> },
): Promise<string> {
  const content = `deliberate task_id:${payload.taskId} proposal_id:${payload.proposalId}`;
  const body = JSON.stringify({ user_id: 'coordinator', content, metadata: payload.metadata });
  const signature = signBody(webhookSecret, body);

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IronClaw dispatch failed (${res.status}): ${err}`);
  }
  const data = await res.json() as { message_id: string };
  return data.message_id;
}

export async function probeWebhook(webhookUrl: string, webhookSecret: string): Promise<boolean> {
  try {
    const body = JSON.stringify({ user_id: 'probe', content: 'ping' });
    const signature = signBody(webhookSecret, body);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * v0.28.1 removed the status polling endpoint. There is no way to query
 * IronClaw for message status — completion is signaled by the worker
 * writing to Ensue at `coordination/tasks/{DID}/status`.
 *
 * The coordinator's `memory-monitor.ts` Ensue polling loop is the
 * authoritative completion signal. This function is kept as a stub for
 * backward compatibility with any caller that expected it, but it now
 * always returns a "running" status.
 */
export async function pollJobStatus(): Promise<never> {
  throw new Error(
    'pollJobStatus is not supported on IronClaw v0.28.1+ — completion is detected via Ensue polling in memory-monitor.ts',
  );
}
