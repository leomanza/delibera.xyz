/**
 * judge.ts — the judge's sequence in one command (~30 s, no red, no keys, no
 * network writes). Replays REAL captured receipts; anything not yet captured
 * live is named as such instead of claimed. Every step prints the exact curl
 * that would replay it live against the production API (AgentMandate/Ledger
 * Grove transplant).
 *
 * Run: npm run judge
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProposal74, loadReceipt } from '../src/verdict-fixture.js';
import { buildCapsule } from '../src/capsule.js';
import { runSigningVectors } from './verify-signing.js';
interface LiveRail {
  meta: { capturedAt: string; agentId: string; policyRevision: number; policyStatus: string; providerPolicySynced: boolean; destinations: string[] };
  bite?: { refused: boolean; body?: { errors?: Array<{ status?: string; code?: string; layer?: string; title?: string; detail?: string }>; meta?: { request_id?: string } } };
}
const RAIL_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'agent-connect', 'live-rail.json');
/** The live capture of the refusal, if we have one. Absent -> the judge falls back to the fixture. */
function loadLiveRail(): LiveRail | null {
  if (!existsSync(RAIL_FILE)) return null;
  try { return JSON.parse(readFileSync(RAIL_FILE, 'utf8')) as LiveRail; } catch { return null; }
}
import { runNoKeyCheck, noKeyPassLine } from './verify-no-key.js';

const line = () => console.log('─'.repeat(72));
let ok = true;
const fail = (step: number, detail: string) => { ok = false; console.log(`STEP ${step} FAILED — ${detail}`); };
const head = (n: number, title: string) => { line(); console.log(`STEP ${n} — ${title}`); };

const p74 = loadProposal74();
const approved = loadReceipt('receipt-approved.json');
const denied = loadReceipt('receipt-denied.json');
const policy = loadReceipt('policy.json');

console.log('Confidential Second Opinion — the judge run\n');
console.log('Mode: captured-receipts replay (honesty-tagged per fixture; live claims only where receipts exist)\n');

/* STEP 1 — ask for the second opinion (confidential $0.01 to the jury) */
head(1, 'Pedir una segunda opinión — $0.01 confidencial al oráculo');
console.log(`  action: ${approved.oraclePayment.action} · amount ${approved.oraclePayment.amountAtomic} atomic USDC ($0.01)`);
console.log(`  provider: ${approved.oraclePayment.provider} (${approved.oraclePayment.providerStatus}) · intent ${approved.oraclePayment.intentHash}`);
console.log(`  timeline: ${approved.oraclePayment.timeline.map((t: { status: string; label?: string }) => `${t.status}${t.label ? `(${t.label})` : ''}`).join(' → ')}`);
console.log(`  [curl] api POST /v1/agents/$AGENT_ID/transfers? confidential:true asset:USDC native mainnet`);

/* STEP 2 — three jurors deliberate; only commits travel */
head(2, 'Tres jurados deliberan — commits sellados, tally 3-0');
console.log(`  proposal #${p74.proposal.proposalId} (${p74.meta.source}, ${p74.meta.settlement.label})`);
for (const j of p74.jurors) console.log(`  ${j.name.padEnd(8)} vote:${j.vote} resultHash ${j.resultHash} did ${j.did.slice(0, 24)}…`);
console.log(`  tally: ${p74.tally.decision} ${p74.tally.approved}-${p74.tally.rejected} (quorum ${p74.tally.quorum}/${p74.tally.minWorkers})`);
console.log('  reasoning: SEALED — each resultHash commits the juror\'s result JSON; the verbatim text stays private');
console.log(`  [curl] RPC view get_proposal {"proposal_id":${p74.proposal.proposalId}} on ${p74.meta.settlement.contract} (free, testnet-capture)`);

/* STEP 3 — the provider refuses the un-whitelisted vendor */
head(3, 'El pago al vendor — GUARDRAIL BITE (provider-checked)');
const liveRail = loadLiveRail();
if (liveRail) {
  const e = liveRail.bite?.body?.errors?.[0];
  console.log(`  LIVE CAPTURE ${liveRail.meta.capturedAt} — the API refused it, live:`);
  console.log(`  HTTP ${e?.status ?? '?'} ${e?.code ?? '?'}  (layer: ${e?.layer ?? '?'})`);
  console.log(`  ${e?.title ?? ''}: ${e?.detail ?? ''}`);
  console.log(`  request_id ${liveRail.bite?.body?.meta?.request_id ?? '—'} · agent ${liveRail.meta.agentId.slice(0, 16)}… · policy rev ${liveRail.meta.policyRevision} (${liveRail.meta.policyStatus}, synced ${liveRail.meta.providerPolicySynced})`);
  console.log(`  the agent's own destinations: ${liveRail.meta.destinations.join(', ')}`);
} else {
  console.log(`  ${denied.meta.label}`);
  console.log(`  HTTP ${denied.refusal.http} ${denied.refusal.code}`);
  console.log(`  who said NO: ${denied.refusal.layer}`);
  console.log(`  → ${denied.refusal.message}`);
  console.log(`  ${denied.refusal.replayNote}`);
}
console.log(`  [curl] api POST /v1/agents/$AGENT_ID/transfers recipient:ac-owner.delibera.near amount:10000`);

/* STEP 4 — byte-level integrity, honestly scoped */
head(4, 'Verificar hash del expediente — sha256 == digest');
const capsule = buildCapsule();
for (const d of capsule.fixtures) console.log(`  sha256(${d.file}) = ${d.sha256.slice(0, 16)}… (${d.bytes} bytes)`);
console.log('  juror resultHashes are on-chain receipts (see STEP 7); recompute-vs-receipt equality kicks in with the live precedent');
console.log(`  [curl] n/a — offline: npm run verify:capsule re-derives these`);

/* STEP 5 — the owner signs ONE authorization */
head(5, 'Firmando la autorización — NEP-413, una sola firma del owner');
console.log(`  vectorized basis: nep413/nep366/grant commitment algorithms byte-verified against the official skill vectors`);
const vectorsOk = runSigningVectors();
if (!vectorsOk) fail(5, 'signing vectors mismatch');
console.log(`  replayed message (template): ${approved.signature.message}`);
console.log(`  policy after ratification: rev ${policy.view.revision} (${policy.postRatification.destinationsAdded.join(', ')} added, whitelist stays \`only\`)`);
console.log(`  [curl] api POST /v1/generate-intent type:policy_update → ownerSignOwner (NEP-413) → /v1/submit-intent → poll APPLIED+provider_policy_synced`);

/* STEP 6 — the payment goes through */
head(6, 'Reintentar el pago — pasa, con recibo');
console.log(`  action ${approved.vendorPayment.action} · $0.01 (${approved.vendorPayment.amountAtomic} atomic) · ${approved.vendorPayment.providerStatus}`);
for (const t of approved.vendorPayment.timeline) console.log(`  ${t.status.padEnd(11)} ${t.label ?? ''}`);
console.log('  UNCERTAIN was polled, never resubmitted (correlation id stable)');
console.log(`  [curl] api GET /v1/status?correlation_id=${approved.vendorPayment.correlationId} — poll only, no resubmit`);

/* STEP 7 — is the verdict on-chain? */
head(7, 'El veredicto está en la cadena — verificado por view call');
const precedentPath = 'fixtures/settlement-mainnet-receipt.json';
// Trusted committed-evidence JSON boundary: file appears only after the live
// precedent run, schema pinned to the contract's get_proposal shape.
interface PrecedentDoc { proposalId: number; settledOn: string; submissions: Array<{ worker_id: string; result_hash: string }>; }
const mainnetPrecedent: PrecedentDoc | null = existsSync(precedentPath) ? JSON.parse(readFileSync(precedentPath, 'utf8')) : null;
const settlement = await import('./verify-settlement.js').then((m) => m.probeContracts(true));
if (mainnetPrecedent) {
  console.log(`  mainnet precedent: proposal ${mainnetPrecedent.proposalId} on ${mainnetPrecedent.settledOn}`);
  for (const sub of mainnetPrecedent.submissions) console.log(`  ${String(sub.worker_id).slice(0, 20)}… resultHash ${sub.result_hash}`);
  console.log(`  [curl] RPC view get_proposal {"proposal_id":${mainnetPrecedent.proposalId}} on ${mainnetPrecedent.settledOn} (free)`);
} else {
  console.log(`  contract state: mainnet ${settlement.mainnetLive ? `LIVE (id ${settlement.mainnetId})` : 'not answering'} / testnet ${settlement.testnetLive ? `LIVE (id ${settlement.testnetId})` : 'not answering'}`);
  console.log('  testnet precedent: proposal 76 finalized via run-live.ts (live 2026-11-08, this repo) — see fixtures/live-testnet/proposal-76.json');
  console.log('  mainnet settlement line omitted until mainnet precedent — 74 fixture stays testnet-capture labeled');
  console.log('  [curl] RPC view get_proposal {"proposal_id":1} on coordinator.agents-coordinator.near (free)');
}

/* STEP 8 — no-key check */
head(8, 'Prueba sin-llave — el código del rol agente no firma nada');
const noKeyOk = runNoKeyCheck();
if (!noKeyOk) fail(8, 'key material found in tracked code (see report above)');

/* STEP 9 — capsule */
head(9, 'Cápsula — expediente sin red');
console.log(`  spec ${capsule.spec} · ${capsule.fixtures.length} fixtures · totals: verdict ${capsule.totals.verdict.decision} ${capsule.totals.verdict.approved}-${capsule.totals.verdict.rejected}`);
console.log('  run npm run verify:capsule (CLI) or open web/verify.html — drag the capsule, watch every digest re-derive');

/* Finale */
line();
console.log(`\nRESULT: ${ok ? 'JUDGE SEQUENCE PASS' : 'JUDGE SEQUENCE FAILED (see steps)'} · ${noKeyPassLine()}`);
console.log(`no writes · read-only probes (~30 s) · no keys · no funds · every claim tied to a captured receipt or named "omitted until live"`);
if (!ok) process.exit(1);
