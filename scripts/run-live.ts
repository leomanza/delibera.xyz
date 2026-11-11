/**
 * run-live.ts — the full deliberation loop in one runner (testnet-only here).
 *
 * Transplanted from Delibera coordinator-agent/src/monitor/memory-monitor.ts
 * (triggerLocalCoordination), trimmed to the verdict spine:
 *   snapshot → trigger workers (Ensue) → start on-chain → wait results →
 *   record submissions (nullifier: did + sha256) → tally → archive to Ensue →
 *   coordinator_resume — then the receipt goes to fixtures/live-testnet/.
 *
 * Workers are the 3 running worker-agents (repos worker-agent{,1,2,3} from
 * Delibera); they self-poll `coordination/config/task_definition` until their
 * DID status is `pending`. Keys layout is Deliverse-shared-compatible:
 *   coordination/tasks/<did>/{status,result,timestamp}
 *   coordination/coordinator/{proposal_id,status,tally}
 *   coordination/proposals/<id>/{config,status,tally} + workers/<did>/{result,ts}
 *
 * Safety: requires NEAR_SEED_PHRASE + ENSUE_API_KEY in env (never echoed);
 * refuses NEAR_NETWORK=mainnet unless --i-understand-mainnet is passed.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensue, ensueConfigured } from '../src/ensue.js';

/* Secrets stay in the ORIGINAL repo's env file (never copied). dotenv-style
 * safe loader — POSIX sourcing breaks on seed phrases (words with spaces).
 * Runs BEFORE contract.js is imported: its config helpers read process.env
 * lazily, and this fills it first. */
function loadEnvFile(path: string): void {
  if (!path) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(process.env.NEAR_ENV_FILE || '');
const { startCoordination, recordWorkerSubmissions, coordinatorResume, viewCall } = await import('../src/contract.js');


const SEED_PHRASE_SET = !!process.env.NEAR_SEED_PHRASE;
const MAINNET_FORCED = process.argv.includes('--i-understand-mainnet');
const NEAR_NETWORK = process.env.NEAR_NETWORK || 'testnet';
const WORKER_TIMEOUT = Number(process.env.LIVE_TIMEOUT_MS || 240_000);
const POLLS_MS = 4_000;

/* Delibera-shared-compatible key layout (no @delibera-xyz import needed) */
const TASK_CONFIG_KEY = 'coordination/config/task_definition';
const COORDINATOR_PROPOSAL_ID_KEY = 'coordination/coordinator/proposal_id';
const COORDINATOR_STATUS_KEY = 'coordination/coordinator/status';
const workerKeys = (did: string) => ({
  STATUS: `coordination/tasks/${did}/status`,
  RESULT: `coordination/tasks/${did}/result`,
  TIMESTAMP: `coordination/tasks/${did}/timestamp`,
});
const step = (n: number, label: string) => console.log(`\nSTEP ${n} — ${label}`);

function fatal(msg: string): never {
  console.error(`RUN-LIVE ABORT: ${msg}`);
  process.exit(1);
}

/** Permanent Ensue states use create-if-missing then update (set is idempotent). */
async function put(key: string, value: string): Promise<void> {
  await ensue.set(key, value);
}

async function readStatus(did: string): Promise<string | undefined> {
  return (await ensue.get(workerKeys(did).STATUS))?.trim();
}

interface WorkerResultDoc { workerId?: string; output?: { value?: number; vote?: string }; }

/* Trusted boundary: worker output is the JSON string fetched from Ensue.
 * Unparsable bytes are evidence-tampering, not a default-vote. */
function parseWorkerResult(raw: string): WorkerResultDoc | null {
  try {
    return JSON.parse(raw) as WorkerResultDoc;
  } catch {
    return null;
  }
}

export async function runLive(args: {
  dids: string[];
  proposalText: string;
  labels?: string[]; // friendly names per did
  resumeOnly?: number; // finish an already-started proposal (id)
  }): Promise<{ proposalId: number; tally: TallyDoc }> {
  const { dids, proposalText, labels, resumeOnly } = args;
  if (!ensueConfigured()) fatal('ENSUE_API_KEY not set — live run is gated');
  if (!SEED_PHRASE_SET) fatal('NEAR_SEED_PHRASE not set — settlement needs the coordinator account key (keep it in .env, never echoed)');
  if (dids.length < 3) fatal('need at least 3 worker DIDs (the demo quorum is 3)');
  if (NEAR_NETWORK === 'mainnet' && !MAINNET_FORCED) {
    fatal('NEAR_NETWORK=mainnet requires --i-understand-mainnet (product decision; testnet is the correctness venue)');
  }

  let proposalId: number;
  const taskConfig = JSON.stringify({
    type: 'vote',
    parameters: { proposal: proposalText, voting_config: { min_workers: 3, quorum: 2 } },
    timeout: 30_000,
  });
  const configHash = createHash('sha256').update(taskConfig).digest('hex');

  if (resumeOnly) {
    step(1, 'Resume-only — jump to submissions');
    proposalId = resumeOnly;
    console.log(`  finishing proposal #${proposalId} (already opened by a previous run)`);
  } else {
    step(1, 'Snapshot — contract head before the run');
    const contractName = process.env.VERDICT_CONTRACT_ID || (NEAR_NETWORK === 'mainnet' ? 'coordinator.agents-coordinator.near' : 'coordinator.agents-coordinator.testnet');
    const beforeId = (await viewCall<number>('get_current_proposal_id', {})) ?? 0;
    console.log(`  contract ${contractName} (${NEAR_NETWORK}) current proposal id: ${beforeId}`);

    step(2, 'Trigger — write task config + pending states to Ensue');
    await put(COORDINATOR_STATUS_KEY, 'monitoring');
    await put(TASK_CONFIG_KEY, taskConfig);
    for (const did of dids) {
      await put(workerKeys(did).STATUS, 'pending');
    }
    console.log(`  task config written (${taskConfig.length} bytes); ${dids.length} workers set pending`);

    step(3, 'On-chain start — start_coordination');
    const started = await startCoordination(taskConfig, dids.length, 2);
    if (started === null) fatal('contract did not open a proposal (no id bump in 15s) — check signer key against the contract');
    proposalId = started;
    await put(COORDINATOR_PROPOSAL_ID_KEY, String(proposalId));
    console.log(`  proposal #${proposalId} opened`);
  }

  step(4, 'Wait — poll per-worker status or result presence');
  const deadline = Date.now() + WORKER_TIMEOUT;
  const pending = new Set(dids);
  while (Date.now() < deadline && pending.size > 0) {
    for (const did of Array.from(pending)) {
      const result = await ensue.get(workerKeys(did).RESULT);
      const status = await readStatus(did);
      // workers mark idle after finishing (result is the source of truth)
      if (result || status === 'completed') pending.delete(did);
      else if (status === 'failed' && !result) fatal(`worker ${did} reported failed`);
    }
    if (pending.size > 0) await new Promise((r) => setTimeout(r, POLLS_MS));
  }
  if (pending.size > 0) fatal(`workers did not finish in ${WORKER_TIMEOUT / 1000}s: ${Array.from(pending).join(', ')}`);
  console.log(`  all ${dids.length} workers completed`);

  step(5, 'Submissions — did + sha256(result) (nullifier)');
  const submissions: Array<{ worker_id: string; result_hash: string }> = [];
  const resultsByDid: Record<string, string | undefined> = {};
  for (const did of dids) {
    const raw = await ensue.get(workerKeys(did).RESULT);
    resultsByDid[did] = raw ?? undefined;
    if (!raw) fatal(`no result for ${did}`);
    const workerId = parseWorkerResult(raw)?.workerId ?? did; // key path is the source of truth (IronClaw pattern)
    submissions.push({ worker_id: workerId, result_hash: createHash('sha256').update(raw).digest('hex') });
  }
  for (const s of submissions) console.log(`  ${s.worker_id.slice(0, 22)}… resultHash ${s.result_hash.slice(0, 16)}…`);

  step(6, 'Record on-chain — record_worker_submissions');
  const recorded = await recordWorkerSubmissions(proposalId, submissions);
  if (!recorded) fatal('record_worker_submissions failed');
  console.log(`  recorded ${submissions.length} submissions for proposal #${proposalId}`);

  step(7, 'Tally');
  const tally = (() => {
    try {
      return buildTally(dids, resultsByDid);
    } catch (e) {
      fatal(`RUN-LIVE ABORT: ${e instanceof Error ? e.message : String(e)}`);
    }
  })();
  printTally(tally, dids, resultsByDid, labels);
  await put('coordination/coordinator/tally', JSON.stringify(tally));

  step(8, 'Archive — persistent proposal history (74-layout)');
  await archiveProposal(String(proposalId), taskConfig, tally, dids, resultsByDid);
  console.log(`  archived under coordination/proposals/${proposalId}/…`);

  step(9, 'Settle — coordinator_resume');
  const aggregatedResult = JSON.stringify({
    aggregatedValue: tally.rules.approved >= tally.rules.rejected ? 1 : 0,
    approved: tally.rules.approved,
    rejected: tally.rules.rejected,
    decision: tally.decision,
    workerCount: tally.rules.workerCount,
    timestamp: new Date().toISOString(),
    proposalId,
  });
  const resultHash = createHash('sha256').update(aggregatedResult).digest('hex');
  const resumed = await coordinatorResume(proposalId, aggregatedResult, configHash, resultHash);
  if (!resumed) fatal('coordinator_resume returned false');
  console.log(`  settled on-chain (${NEAR_NETWORK}) — resultHash ${resultHash.slice(0, 16)}…`);
  await put(COORDINATOR_STATUS_KEY, 'completed');

  step(10, 'Receipt — view state + file');
  const proposal = await viewCall<Record<string, unknown>>('get_proposal', { proposal_id: proposalId });
  const finalized = await viewCall<Record<string, unknown>>('get_finalized_coordination', { proposal_id: proposalId });
  dumpReceipt(proposalId, { taskConfig, tally, submissions, aggregatedResult, resultHash, proposal, finalized });
  console.log(`\nRUN-LIVE ${NEAR_NETWORK.toUpperCase()}: proposal ${proposalId} · verdict ${tally.decision} ${tally.rules.approved}-${tally.rules.rejected} · settled on-chain`);
  return { proposalId, tally };
}

interface TallyDoc { decision: string; rules: { approved: number; rejected: number; workerCount: number; quorum: number }; timestamp: string }

/** Aggregates worker votes — exported for tests (no network use). */
export function buildTally(dids: string[], resultsByDid: Record<string, string | undefined>): TallyDoc {
  let approved = 0;
  let rejected = 0;
  for (const did of dids) {
    const raw = resultsByDid[did];
    if (!raw) continue;
    const r = parseWorkerResult(raw);
    if (!r) throw new Error(`malformed worker result from ${did} — settle only on parsable evidence`);
    const yes = r.output?.value === 1 || /^approved$/i.test(r.output?.vote || '');
    if (yes) approved++; else rejected++;
  }
  return { decision: approved > rejected ? 'Approved' : 'Rejected', rules: { approved, rejected, workerCount: dids.length, quorum: 2 }, timestamp: new Date().toISOString() };
}

function printTally(t: TallyDoc, dids: string[], resultsByDid: Record<string, string | undefined>, labels?: string[]): void {
  dids.forEach((did, i) => {
    const raw = resultsByDid[did];
    const parsed = raw ? parseWorkerResult(raw) : null;
    const yes = parsed && (parsed.output?.value === 1 || /^approved$/i.test(parsed.output?.vote || ''));
    const vote = !raw ? 'no result' : (!parsed ? 'malformed' : yes ? 'Approved' : 'Rejected');
    const l = labels?.[i] || `worker ${i + 1}`;
    console.log(`  ${l.padEnd(10)} ${did.slice(0, 24)}… vote:${vote}`);
  });
  console.log(`  tally: ${t.decision} ${t.rules.approved}-${t.rules.rejected} (quorum ${t.rules.quorum}/${t.rules.workerCount})`);
}

async function archiveProposal(pid: string, taskConfig: string, tally: TallyDoc, dids: string[], resultsByDid: Record<string, string | undefined>): Promise<void> {
  await put(`coordination/proposals/${pid}/config`, taskConfig);
  await put(`coordination/proposals/${pid}/status`, 'finalized');
  await put(`coordination/proposals/${pid}/tally`, JSON.stringify(tally));
  for (const did of dids) {
    const r = resultsByDid[did];
    if (r) {
      await put(`coordination/proposals/${pid}/workers/${did}/result`, r);
      await put(`coordination/proposals/${pid}/workers/${did}/timestamp`, new Date().toISOString());
    }
  }
}

function dumpReceipt(proposalId: number, payload: Record<string, unknown>): void {
  const dir = join(process.cwd(), 'fixtures', NEAR_NETWORK === 'mainnet' ? 'live-mainnet' : 'live-testnet');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `proposal-${proposalId}.json`);
  writeFileSync(file, JSON.stringify({ meta: { capturedAt: new Date().toISOString(), network: NEAR_NETWORK, contract: process.env.VERDICT_CONTRACT_ID || (NEAR_NETWORK === 'mainnet' ? 'coordinator.agents-coordinator.near' : 'coordinator.agents-coordinator.testnet'), kind: 'live-run' }, ...payload }, null, 2) + '\n');
  console.log(`  receipt → ${file.replace(process.cwd() + '/', '')}`);
}

/* CLI: --dids a,b,c --text "..." --labels "a,b,c" */
if (process.argv[1]?.includes('run-live')) {
  void (async () => {
    const get = (name: string) => { const a = process.argv.find((x) => x === `--${name}`); return a ? process.argv[process.argv.indexOf(a) + 1] : undefined; };
    const dids = (get('dids') || '').split(',').filter(Boolean);
    const labels = get('labels')?.split(',');
    const resumeOnlyArg = get('resume-only');
    const resumeOnly = resumeOnlyArg ? Number(resumeOnlyArg) : undefined;
    const text = get('text') || 'Renewal case (demo transcript replay): an owner policy refused a $0.01 payment to ac-owner.delibera.near (whitelist only). A private jury of 3 agents re-reviewed; should this payment have been allowed?';
    if (dids.length < 3) fatal('usage: npm run live:testnet -- --dids did1,did2,did3 [--labels n1,n2,n3] [--text "..."] [--resume-only <proposalId>]');
    const out = await runLive({ dids, proposalText: text, labels, resumeOnly });
    process.exit(0); // reaching here means full success — every failure path is fatal()
  })();
}
