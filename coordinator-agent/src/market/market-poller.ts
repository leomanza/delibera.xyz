/**
 * market-poller.ts — Delibera × Agent Market worker loop (task 2, additive).
 *
 * Standalone process. Polls market.near.ai for fresh assignments, runs each
 * proposal through the local Delibera flow (coordinator :3000 + 3 workers),
 * and submits the verdict as deliverableMarkdown. Outbound-only: no inbound
 * hosting required.
 *
 * Scope (kept minimal on purpose):
 *   - fresh assignments only (startedAt=null, deliverableUrl=null)
 *   - rework / disputes are logged and skipped — founder handles manually
 *   - one assignment at a time (the local flow is single-proposal)
 *
 * Run: npm run market:poller   (loads .env.development.local like `dev`)
 * Env: MARKET_API_TOKEN, MARKET_BASE_URL (default https://market.near.ai),
 *      COORDINATOR_URL (default http://localhost:3000)
 */

const MARKET = (process.env.MARKET_BASE_URL || 'https://market.near.ai').replace(/\/$/, '');
const TOKEN = process.env.MARKET_API_TOKEN || '';
const COORDINATOR = (process.env.COORDINATOR_URL || 'http://localhost:3000').replace(/\/$/, '');

const POLL_MS = 45_000;          // market poll cadence (skill says 30-60s)
const STATUS_POLL_MS = 5_000;    // local status poll cadence
const FLOW_TIMEOUT_MS = 240_000; // local flow must finish well inside this

interface JobAssignment {
  assignmentId: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  deliverableUrl: string | null;
  slaDeadlineAt: string;
  escrowAmount: string;
  escrowToken: string;
}

interface AssignmentItem {
  assignment: JobAssignment;
  job: { jobId: string; title: string; description: string; tags: string[] };
  latestMessage: { body?: string; truncated?: boolean } | null;
}

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), '[market]', ...args);
}

async function marketApi(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${MARKET}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`market ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

async function coordinatorApi(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${COORDINATOR}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`coordinator ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function proposalFrom(item: AssignmentItem): string {
  const { title, description } = item.job;
  return `Title: ${title}\n\n${description}`.slice(0, 4000);
}

async function runVerdict(proposal: string) {
  await coordinatorApi('/api/coordinate/trigger', {
    method: 'POST',
    body: JSON.stringify({
      taskConfig: {
        type: 'vote',
        // quorum = minimum approvals to pass. 2 of 3 = majority verdict.
        parameters: { proposal, voting_config: { min_workers: 3, quorum: 2 } },
      },
    }),
  });

  const deadline = Date.now() + FLOW_TIMEOUT_MS;
  let status: any = null;
  while (Date.now() < deadline) {
    await sleep(STATUS_POLL_MS);
    status = await coordinatorApi('/api/coordinate/status');
    if (status?.status === 'completed' && status?.tally) return status;
    if (status?.status === 'failed') throw new Error('local coordination failed');
  }
  throw new Error(`local flow timed out after ${FLOW_TIMEOUT_MS / 1000}s`);
}

function verdictMarkdown(proposal: string, result: any): string {
  const t = result.tally;
  const lines: string[] = [];
  lines.push(`# Delibera Verdict: ${t.decision} (${t.approved}–${t.rejected})`);
  lines.push('');
  lines.push('Three independent AI workers deliberated privately on your proposal.');
  lines.push('Individual reasoning stayed off-chain; only the aggregate tally was');
  lines.push('settled on NEAR testnet.');
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`- **Decision:** ${t.decision}`);
  lines.push(`- **Tally:** ${t.approved} Approved / ${t.rejected} Rejected (${t.workerCount} workers)`);
  lines.push(`- **Settled on-chain:** proposal #${result.proposalId} on \`coordinator.agents-coordinator.testnet\` (state \`Finalized\`)`);
  lines.push(`- **Timestamp:** ${t.timestamp}`);
  lines.push('');
  lines.push('## Worker reasoning (private deliberation, disclosed to you as buyer)');
  lines.push('');
  for (const w of t.workers || []) {
    const name = w.display_name || t.workerNames?.[w.workerId] || w.workerId || 'worker';
    const vote = w.output?.vote ?? w.vote ?? '?';
    const reasoning = w.output?.reasoning ?? w.reasoning ?? '(no reasoning captured)';
    lines.push(`### ${name} — ${vote}`);
    lines.push('');
    lines.push(reasoning);
    lines.push('');
  }
  lines.push('## Verify it yourself');
  lines.push('');
  lines.push('```');
  lines.push(`curl -s https://test.rpc.fastnear.com/ -H 'Content-Type: application/json' \\`);
  lines.push(`  -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"coordinator.agents-coordinator.testnet","method_name":"get_proposal","args_base64":"${Buffer.from(JSON.stringify({ proposal_id: result.proposalId })).toString('base64')}"}}'`);
  lines.push('```');
  lines.push('');
  lines.push('Advisory only: a private second opinion to inform your decision, not a');
  lines.push('replacement for it. Settlement is NEAR **testnet**; no TEE attestation in');
  lines.push('this build.');
  return lines.join('\n');
}

async function processAssignment(item: AssignmentItem) {
  const id = item.assignment.assignmentId;
  log(`fresh assignment ${id} — "${item.job.title}" (escrow ${item.assignment.escrowAmount} ${item.assignment.escrowToken})`);

  await marketApi(`/v1/assignments/${id}/start`, { method: 'POST' });
  log(`started ${id}`);

  const proposal = proposalFrom(item);
  const result = await runVerdict(proposal);
  log(`verdict ready for ${id}: ${result.tally.decision} (${result.tally.approved}-${result.tally.rejected}), proposal #${result.proposalId}`);

  const markdown = verdictMarkdown(proposal, result);
  await marketApi(`/v1/assignments/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ deliverableMarkdown: markdown }),
  });
  log(`submitted ${id}`);
}

async function pollOnce() {
  const data = await marketApi('/v1/agents/me/assignments');
  const items: AssignmentItem[] = data?.assignments || [];

  const fresh = items.filter(
    (i) => i.assignment.startedAt === null && i.assignment.deliverableUrl === null,
  );
  const rework = items.filter(
    (i) => i.assignment.startedAt !== null && i.assignment.submittedAt !== null,
  );
  if (rework.length > 0) {
    log(`NOTE: ${rework.length} assignment(s) need rework/dispute attention — handle manually: ${rework.map((r) => r.assignment.assignmentId).join(', ')}`);
  }

  for (const item of fresh) {
    try {
      await processAssignment(item);
    } catch (err) {
      log(`ERROR on ${item.assignment.assignmentId}:`, (err as Error).message);
    }
  }
}

async function main() {
  if (!TOKEN) {
    console.error('MARKET_API_TOKEN is not set. Add it to .env.development.local.');
    process.exit(1);
  }
  // Dev self-test: run one verdict end-to-end without touching the market.
  // MARKET_SELFTEST_PROPOSAL="..." npm run market:poller
  const selftest = process.env.MARKET_SELFTEST_PROPOSAL;
  if (selftest) {
    log('SELFTEST mode — no market calls');
    const result = await runVerdict(selftest);
    console.log(verdictMarkdown(selftest, result));
    process.exit(0);
  }
  log(`polling ${MARKET} every ${POLL_MS / 1000}s as a Delibera worker; coordinator at ${COORDINATOR}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollOnce();
    } catch (err) {
      log('poll error:', (err as Error).message);
    }
    await sleep(POLL_MS);
  }
}

main();
