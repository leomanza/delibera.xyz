/**
 * demo.ts — "The council inside the spending rules" terminal demo.
 *
 * Implements the 60-second beats from doc/plans/agent-connect-verdict-gated-spending.md
 * against the REAL Delibera verdict engine (coordinator :3000 + 3 workers) and
 * the Agent Connect API (real when NEAR_INTENTS_AGENT_API_KEY is set, offline
 * mock otherwise — the mock enforces the real policy semantics + error codes).
 *
 * Run: npm run agent-connect:demo          (loads .env.development.local)
 * Two runs back-to-back:
 *   RUN 1: a bad proposal → jury Rejects → the wallet refuses the forced spend
 *   RUN 2: a good proposal → jury Approves → owner ratifies → spend executes
 */

import {
  createAgentWithPolicy, issueGrant, fund, transfer, updatePolicyDestinations,
  isMock, Policy, AgentApiError,
} from './client';

const COORDINATOR = (process.env.COORDINATOR_URL || 'http://localhost:3000').replace(/\/$/, '');
const ORACLE_ACCOUNT = process.env.AGENT_CONNECT_ORACLE_ACCOUNT || 'ac-oracle.delibera.near';
const VENDOR_ACCOUNT = process.env.AGENT_CONNECT_VENDOR_ACCOUNT || 'ac-owner.delibera.near';
const USDC = '<usdc asset_id>'; // resolved from GET /v1/tokens in real mode

const DEMO_POLICY: Policy = {
  frozen: false,
  actions: ['transfer'],
  confidential: true,
  owner_approval: false, // docs-verified: no destination exception; whitelist IS the gate
  assets: [USDC],
  limits: { per_transaction: { [USDC]: '100000' } }, // $0.10 ceiling
  max_actions_per_hour: 20,
  destinations: { mode: 'only', list: [{ action: 'transfer', address: ORACLE_ACCOUNT, confidential: true }] },
  budget: { daily_usd: '0.20', weekly_usd: null, monthly_usd: '0.20' },
  timelock_ms: 0,
};

function beat(t: string, msg: string) {
  console.log(`\n[${t}] ${msg}`);
}
function line() {
  console.log('─'.repeat(72));
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getVerdict(proposal: string): Promise<any> {
  await fetch(`${COORDINATOR}/api/coordinate/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskConfig: { type: 'vote', parameters: { proposal, voting_config: { min_workers: 3, quorum: 2 } } },
    }),
  });
  const deadline = Date.now() + 240_000;
  for (;;) {
    await sleep(5_000);
    const s: any = await (await fetch(`${COORDINATOR}/api/coordinate/status`)).json();
    if (s?.status === 'completed' && s?.tally) return s;
    if (s?.status === 'failed') throw new Error('local coordination failed');
    if (Date.now() > deadline) throw new Error('verdict timed out');
  }
}

function showVerdictCard(result: any) {
  const t = result.tally;
  line();
  console.log(`  VERDICT: ${t.decision} (${t.approved}–${t.rejected})  ·  3 private jurors  ·  settled on-chain (proposal #${result.proposalId})`);
  for (const w of (t.workers || []).slice(0, 3)) {
    const name = t.workerNames?.[w.workerId] || w.workerId?.slice(8, 20) || 'juror';
    const vote = w.output?.vote ?? '?';
    const reasoning = (w.output?.reasoning ?? '').split('\n')[0].slice(0, 110);
    console.log(`    · ${name}: ${vote} — "${reasoning}…"`);
  }
  line();
}

async function runScenario(opts: { title: string; proposal: string; expectBite: boolean }) {
  console.log('\n' + '═'.repeat(72));
  console.log(`  ${opts.title}`);
  console.log('═'.repeat(72));

  beat('0:00', `chat → "${opts.proposal.split('.')[0]}…" — owner asks the assistant to check it`);
  beat('0:05', `wallet: agent account under owner-signed policy (mode: ${isMock ? 'MOCK, real semantics' : 'LIVE demo API'})`);
  const { agentId } = await createAgentWithPolicy('spending-assistant', DEMO_POLICY);
  await issueGrant(agentId);
  await fund(agentId, 5); // $0.05
  console.log(`      policy: transfer ONLY → ${ORACLE_ACCOUNT} · $0.05 funded · confidential · no swap/withdraw`);
  console.log('      → autonomy is bounded ($0.20) and directed (only the oracle); anything else needs the owner');

  beat('0:15', 'the assistant buys a private verdict — autonomously, inside the rules');
  const pay = await transfer(agentId, ORACLE_ACCOUNT, '10000', true); // $0.01
  console.log(`      ✓ $0.01 confidential transfer → ${ORACLE_ACCOUNT}  (${pay.status}, tx ${pay.txHash || pay.correlationId})`);
  console.log('      a private payment for a private verdict — invisible on-chain');

  beat('0:30', 'three jurors deliberate privately (real Delibera engine — this takes ~90s)…');
  const result = await getVerdict(opts.proposal);
  showVerdictCard(result);
  const approved = result.tally.decision === 'Approved';

  if (approved) {
    beat('0:45', 'verdict Approved → owner ratifies with ONE signature (vendor added to whitelist)');
    await updatePolicyDestinations(agentId, VENDOR_ACCOUNT);
    const spend = await transfer(agentId, VENDOR_ACCOUNT, '10000', false); // $0.01
    console.log(`      ✓ $0.05 → ${VENDOR_ACCOUNT}  (${spend.status}, tx ${spend.txHash || spend.correlationId})`);
    beat('0:55', 'done: judgment was bought autonomously; money moved only after verdict + owner signature');
  } else {
    beat('0:45', 'verdict Rejected → the owner signs NOTHING. the demo forces the spend anyway…');
    try {
      await transfer(agentId, VENDOR_ACCOUNT, '10000', false);
      console.log('      ✗ UNEXPECTED: transfer went through — the gate failed!');
      process.exitCode = 1;
    } catch (err) {
      const e = err as AgentApiError;
      console.log(`      ⛔ THE WALLET REFUSES: ${e.code}`);
      console.log('      the wallet IS the wall — the agent cannot buy its way past a Rejected verdict');
    }
    beat('0:55', 'done: no signature was given, and the signed policy held the line on its own');
  }
}

async function main() {
  console.log('THE COUNCIL INSIDE THE SPENDING RULES');
  console.log('Delibera × NEAR Agent Connect — prototype demo');

  await runScenario({
    title: 'RUN 1 — the bite (bad proposal)',
    proposal:
      'Transfer 20 USDC to an anonymous account with no named recipient, no deliverable, no milestones, and no accountability mechanism. Justification: "trust me".',
    expectBite: true,
  });

  await runScenario({
    title: 'RUN 2 — the happy path (well-formed proposal)',
    proposal:
      'Pay vendor.near 20 USDC for the completed Q3 community-docs security review. Deliverable published and verified, two milestones met on time, final report attached, amount matches the approved quote.',
    expectBite: false,
  });

  console.log('\n' + '═'.repeat(72));
  console.log('  A-HA: my agent can buy private judgment by itself —');
  console.log('  but it cannot move money without a verdict AND my signed rules.');
  console.log('═'.repeat(72) + '\n');
}

main().catch((e) => {
  console.error('\nDEMO ERROR:', e.message);
  process.exit(1);
});
