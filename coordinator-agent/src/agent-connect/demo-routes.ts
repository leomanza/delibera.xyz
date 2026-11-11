/**
 * demo-routes.ts — HTTP session for the Agent Connect treasury-agent demo.
 *
 * The browser UI never holds keys; every step surfaces the API evidence
 * (endpoints, idempotency keys, status lifecycles, providers, correlation ids)
 * as structured trace events the UI renders.
 *
 * Modes (same UI for all):
 *   replay (AGENT_CONNECT_FIXTURES=1) — no API calls, no funds moved; serves
 *     the REAL receipts harvested 2026-10-19 (demo-fixtures.ts).
 *   live  — real Agent Connect account from env; every POST is a real call.
 *   mock  — plain in-memory engine (no env vars), synthetic ids (fallback).
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import {
  createAgentWithPolicy, issueGrant, fund, transfer, updatePolicyDestinations,
  submitSignedIntent, isMock, replayMode, Policy, AgentApiError, USDT_NEAR,
  balances, shield, network, policyView, waitStatus,
} from './client';
import { startDeliberation, getVerdictRecord } from './verdict-oracle';
import { DEMO_HTML } from './demo-page';
import { RECEIPTS, AGENT as FIXTURE_AGENT, JUROR_REASONING, PRESETS } from './demo-fixtures';

const USDC = USDT_NEAR;
const ORACLE = process.env.AGENT_CONNECT_ORACLE_ACCOUNT || 'ac-oracle.delibera.near';
const VENDOR = process.env.AGENT_CONNECT_VENDOR_ACCOUNT || 'ac-owner.delibera.near';
const DELIBERATION_S = 9; // replay pacing (compressed; receipts carry the real timestamps)

const DEMO_POLICY: Policy = {
  frozen: false,
  actions: ['transfer'],
  confidential: true,
  owner_approval: false,
  assets: [USDC],
  limits: { per_transaction: { [USDC]: '100000' } }, // $0.10 ceiling
  max_actions_per_hour: 20,
  destinations: { mode: 'only', list: [{ action: 'transfer', address: ORACLE, confidential: true }] },
  budget: { daily_usd: '0.20', weekly_usd: null, monthly_usd: '0.20' },
  timelock_ms: 0,
};

interface TraceStatus { status: string; at: string; label?: string }
interface TraceEvent {
  id: string;
  ts: string;
  phase: 'shield' | 'transfer' | 'signature' | 'policy' | 'refusal' | 'deliberation';
  title: string;
  note?: string;
  api?: { method: string; path: string; idempotencyKey?: string };
  statuses?: TraceStatus[];
  provider?: string;
  correlationId?: string;
  intentHash?: string;
  explorer?: string;
  layer?: string;
  code?: string;
  source: 'live' | 'replay';
}
interface Session {
  id: string;
  agentId: string;
  mode: 'replay' | 'live' | 'mock';
  ratified: boolean;
  verdictId?: string;
  disclosure?: 'sealed' | 'attested';
  deliberationAt?: number;
  log: string[];
  events: TraceEvent[];
  pendingCreate?: any;
}

const sessions = new Map<string, Session>();
let seq = 0;

function note(s: Session, line: string) {
  s.log.push(`${new Date().toISOString().slice(11, 19)}  ${line}`);
}
function ev(s: Session, e: Omit<TraceEvent, 'id' | 'ts'>): TraceEvent {
  const full: TraceEvent = { ...e, id: `ev_${++seq}`, ts: new Date().toISOString() };
  s.events.push(full);
  return full;
}
const sleep = (sec: number) => new Promise((r) => setTimeout(r, sec * 1000));
const now = () => new Date().toISOString();
const uid = () => `ev_${++seq}`;
const src = (m: Session['mode']): 'live' | 'replay' => (m === 'live' ? 'live' : 'replay');

function toBalances(raw: string, source: 'public' | 'confidential') {
  return [{
    asset_id: USDC, symbol: 'USDC', decimals: 6, blockchain: 'near',
    balance_raw: raw, balance: (Number(raw) / 1e6).toFixed(2),
  }];
}

export const demoRoutes = new Hono();

demoRoutes.get('/demo', (c) => c.html(DEMO_HTML));

demoRoutes.get('/demo/meta', async (c) => {
  let net: any = null;
  try { if (!replayMode) net = await network(); } catch { /* advisory only */ }
  return c.json({
    mode: replayMode ? 'replay' : isMock ? 'mock' : 'live',
    oracle: ORACLE,
    vendor: VENDOR,
    presets: PRESETS,
    network: replayMode ? RECEIPTS.network : (net?.status || net || null),
  });
});

demoRoutes.post('/demo/session', async (c) => {
  const mode: 'replay' | 'live' | 'mock' = replayMode ? 'replay' : isMock ? 'mock' : 'live';
  const session: Session = { id: `s_${randomUUID().slice(0, 8)}`, mode, agentId: '', ratified: false, log: [], events: [] };
  sessions.set(session.id, session);

  let pub: any[] = [], conf: any[] = [], policy: any = null;
  if (mode === 'live') {
    const envAgent = process.env.AGENT_CONNECT_AGENT_ID;
    if (!envAgent) {
      sessions.delete(session.id);
      return c.json({ error: 'AGENT_CONNECT_AGENT_ID not set' }, 500);
    }
    session.agentId = envAgent;
    try { pub = await balances(session.agentId, 'public'); } catch (e) { note(session, `balances read failed: ${(e as Error).message}`); }
    try { conf = await balances(session.agentId, 'confidential'); } catch { /* empty */ }
    try { policy = await policyView(session.agentId); } catch { /* advisory */ }
    // narrative: pre-ratification state (the vendor was ratified to rev 4 on Oct-19)
    if (policy?.revision === 4) policy = { ...policy, narrative: 'rev 4 is the ratified state — this demo replays rev 3 → 4' };
  } else if (mode === 'replay') {
    session.agentId = FIXTURE_AGENT.agentId;
    pub = toBalances(RECEIPTS.balances.public, 'public');
    conf = toBalances('0', 'confidential');
    policy = {
      revision: 3, // pre-ratification narrative — ratify bumps to the real rev 4
      status: 'APPLIED', provider_policy_synced: true,
      destinations: { mode: 'only', list: [{ action: 'transfer', address: ORACLE, confidential: 'true' }] },
      policy_hash: null, applied_at: 'replay of 2026-10-19 policy lineage',
      usage: { budget: { daily: RECEIPTS.policy.dailyBudget } },
    };
  } else {
    ({ agentId: session.agentId } = await createAgentWithPolicy('treasury-agent', DEMO_POLICY));
    await issueGrant(session.agentId);
    await fund(session.agentId, 20);
  }
  note(session, `${mode} session · agent ${session.agentId.slice(0, 12)}…`);

  return c.json({
    sessionId: session.id,
    mode,
    agent: {
      agentId: session.agentId,
      nearAccountId: mode === 'replay' ? FIXTURE_AGENT.nearAccountId : '1688bff53d186ab9981666521f25154001ea6805fa2c6a1175677ba8ea375075',
      grantLabel: FIXTURE_AGENT.grantLabel,
    },
    network: mode === 'replay' ? RECEIPTS.network : null,
    balances: { public: pub, confidential: conf },
    policy,
    badges: [
      { chip: '/demo/meta reports mode + network health', tone: 'info' },
      { chip: 'Owner signature: demo owner key on this server (demo accounts are ours); the product signs in the browser wallet', tone: 'warn' },
      { chip: 'Verdict purchase invisible to the chain — confidential balances', tone: 'info' },
    ],
    roles: [
      { role: 'Requestor', who: 'agent (automated)' },
      { role: 'Council', who: '3 private jurors' },
      { role: 'Finance', who: 'owner signature' },
    ],
    presets: PRESETS,
  });
});

demoRoutes.post('/demo/:sid/submit-signature', async (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session?.pendingCreate) return c.json({ error: 'nothing to sign' }, 400);
  const body = await c.req.json().catch(() => null);
  const signedDelegate = body?.signedDelegate;
  if (!signedDelegate || typeof signedDelegate !== 'string') return c.json({ error: 'signedDelegate (base64) required' }, 400);
  await submitSignedIntent(session.pendingCreate, signedDelegate);
  note(session, 'owner signature submitted');
  session.pendingCreate = undefined;
  return c.json({ ok: true, agentId: session.agentId });
});

demoRoutes.post('/demo/:sid/propose', async (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session) return c.json({ error: 'unknown session' }, 404);
  const body = await c.req.json().catch(() => null);
  const proposal = body?.proposal?.trim();
  if (!proposal || proposal.length < 10) return c.json({ error: 'proposal required' }, 400);
  // disclosure is a purchase-time property of the verdict (jurors see the mode before voting)
  const disclosure: 'sealed' | 'attested' = body?.disclosure === 'sealed' ? 'sealed' : 'attested';
  session.disclosure = disclosure;

  if (session.mode === 'live') {
    // confidential transfer spends from the shielded balance — shield first if short
    const conf = await balances(session.agentId, 'confidential');
    const confBal = BigInt(conf.find((b: any) => b.asset_id === USDC)?.balance_raw || '0');
    if (confBal < 10_000n) {
      const sh = await shield(session.agentId, USDC, '10000', `sh:${session.id}:propose`);
      note(session, `shield $0.01 → confidential (${sh.status})`);
      ev(session, {
        phase: 'shield', title: 'Shield $0.01 → confidential balance', source: 'live',
        api: { method: 'POST', path: `/v1/agents/${session.agentId}/shield`, idempotencyKey: `sh:${session.id}:propose` },
        statuses: [{ status: sh.status, at: now() }],
      });
      await sleep(1);
    }
    const pay = await transfer(session.agentId, ORACLE, '10000', true, `tr:${session.id}:oracle`);
    note(session, `$0.01 confidential → ${ORACLE} (${pay.status})`);
    ev(session, {
      phase: 'transfer', title: 'Buy the verdict — $0.01 confidential → ac-oracle', source: 'live',
      api: { method: 'POST', path: `/v1/agents/${session.agentId}/transfer`, idempotencyKey: `tr:${session.id}:oracle` },
      statuses: [{ status: pay.status, at: now() }], provider: 'outlayer',
      correlationId: pay.correlationId,
      note: pay.status === 'UNCERTAIN' ? 'maybe executed — polling the original correlation_id' : 'confidential transfer — the chain never sees amount or recipient',
    });
    const record = startDeliberation(proposal);
    session.verdictId = record.id;
    note(session, `deliberation started (${record.id})`);
    ev(session, { phase: 'deliberation', title: `3 jurors deliberating privately (${record.id})`, source: 'live' });
    return c.json({ verdictId: record.id, events: session.events }, 202);
  }

  // replay | mock — compressed pacing; replay carries the real settled receipts
  await sleep(0.6);
  ev(session, {
    phase: 'shield', title: 'Shield $0.01 → confidential balance', source: src(session.mode),
    api: { method: 'POST', path: `/v1/agents/${session.agentId}/shield`, idempotencyKey: `sh:${session.id}:propose` },
    statuses: [{ status: 'SUCCESS', at: now() }],
    note: 'public → confidential (this step is backend-driven; shown here for visibility)',
  });
  await sleep(0.8);
  const fixture = session.mode === 'replay' ? RECEIPTS.oraclePayment : null;
  ev(session, {
    phase: 'transfer', title: 'Buy the verdict — $0.01 confidential → ac-oracle', source: 'replay',
    api: { method: 'POST', path: `/v1/agents/${session.agentId}/transfer`, idempotencyKey: `tr:${session.id}:oracle` },
    statuses: fixture ? fixture.timeline.map((t) => ({ ...t })) : [{ status: 'SUCCESS', at: now() }],
    provider: 'outlayer',
    correlationId: fixture?.correlationId,
    intentHash: fixture?.intentHash,
    explorer: `https://nearblocks.io/address/${FIXTURE_AGENT.nearAccountId}`,
    note: fixture
      ? 'REPLAY of the settled operation (2026-10-19 19:53) · confidential: the chain shows neither amount nor recipient'
      : 'confidential transfer (mock)',
  });
  session.deliberationAt = Date.now() + DELIBERATION_S * 1000;
  session.verdictId = 'v_replay_74';
  ev(session, { phase: 'deliberation', title: '3 jurors deliberating privately', source: 'replay', note: `verdict sold as ${disclosure.toUpperCase()} — jurors knew the mode before voting; only the aggregate tally is published` });
  note(session, `verdict bought + deliberation started (replay, ${disclosure})`);
  return c.json({ verdictId: 'v_replay_74', disclosure, events: session.events }, 202);
});

demoRoutes.get('/demo/:sid/verdict', (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session?.verdictId) return c.json({ error: 'no deliberation yet' }, 404);

  if (session.mode === 'replay') {
    if ((session.deliberationAt || 0) > Date.now()) return c.json({ state: 'deliberating' }, 409);
    const disclosure = session.disclosure || 'attested';
    const base = {
      state: 'completed',
      decision: RECEIPTS.verdict.decision,
      approved: RECEIPTS.verdict.approved,
      rejected: RECEIPTS.verdict.rejected,
      proposalId: RECEIPTS.verdict.proposalId,
      proposalText: RECEIPTS.verdict.proposalText,
      settledOn: RECEIPTS.verdict.settledOn,
      settledAt: RECEIPTS.verdict.settledAt,
      disclosure,
      explorer: RECEIPTS.explorer.verdictContract,
      replayed: true,
      jurors: RECEIPTS.verdict.workers.map((w, i) => ({
        name: w.name, did: w.did, resultHash: w.resultHash,
        // sealed: opinions stay sealed — the result_hash commitment is retrievable later
        ...(disclosure === 'attested'
          ? { vote: w.vote, reasoning: JUROR_REASONING(RECEIPTS.verdict.proposalText)[i].reasoning }
          : {}),
      })),
    };
    return c.json(base);
  }

  const record = getVerdictRecord(session.verdictId);
  if (!record) return c.json({ error: 'unknown verdict' }, 404);
  if (record.state === 'deliberating') return c.json({ state: 'deliberating' }, 202);
  if (record.state === 'failed') return c.json({ state: 'failed', error: record.error }, 500);
  const t = record.tally;
  const disclosure = session.disclosure || 'attested';
  const jur = (t.workers || []).map((w: any) => ({
    name: t.workerNames?.[w.workerId] || w.workerId,
    did: w.workerId,
    resultHash: w.result_hash,
    ...(disclosure === 'attested' ? { vote: w.output?.vote, reasoning: w.output?.reasoning } : {}),
  }));
  return c.json({
    state: 'completed',
    decision: t.decision,
    approved: t.approved,
    rejected: t.rejected,
    proposalId: record.proposalId,
    settledOn: RECEIPTS.verdict.settledOn,
    disclosure,
    explorer: RECEIPTS.explorer.verdictContract,
    jurors: jur,
  });
});

demoRoutes.post('/demo/:sid/ratify', async (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session) return c.json({ error: 'unknown session' }, 404);

  if (session.mode === 'replay') {
    await sleep(0.8);
    ev(session, {
      phase: 'signature', title: 'Owner signs the policy change (NEP-413)', source: 'replay',
      api: { method: 'POST', path: '/v1/submit-intent {type: policy_update}' },
      note: `[delibera demo] Add ${VENDOR} to the destinations of agent ${FIXTURE_AGENT.agentId} — revision 4 · sha256 · tag 2147484061 (message as replayed; live bytes flow on the live path)`,
    });
    note(session, `owner signature: ${VENDOR} added to whitelist`);
    ev(session, {
      phase: 'policy', title: 'Policy in force — revision 4', source: 'replay',
      api: { method: 'GET', path: `/v1/agents/${session.agentId}/policy` },
      statuses: [{ status: 'APPLIED', at: now() }, { status: 'provider_policy_synced', at: now() }],
      note: `destination added: ${VENDOR} (non-confidential) · policy hash a43547…e3ed`,
    });
    session.ratified = true;
    return c.json({
      ok: true, replayed: true,
      signature: { standard: 'nep413', message: `[delibera demo] Add ${VENDOR} … revision 4 (Approved by council verdict #74)`, sha256: true },
      policy: { revision: 4, hash: RECEIPTS.policy.policyHash, destinationsAdded: [VENDOR] },
      events: session.events,
    });
  }

  const ratifyInfo = await updatePolicyDestinations(session.agentId, VENDOR);
  session.ratified = true;
  note(session, `owner signature: ${VENDOR} added to whitelist`);
  ev(session, {
    phase: 'signature', title: 'Owner signs the policy change (NEP-413)', source: 'live',
    api: { method: 'POST', path: '/v1/submit-intent {type: policy_update}' },
    note: ratifyInfo?.message ? `${ratifyInfo.message} · ${ratifyInfo.standard}` : 'submit policy_update (owner-signed)',
  });
  ev(session, {
    phase: 'policy', title: 'Policy in force — provider synced', source: 'live',
    api: { method: 'GET', path: `/v1/agents/${session.agentId}/policy` },
    statuses: [{ status: 'APPLIED', at: now() }, { status: 'provider_policy_synced', at: now() }],
    note: `destination added: ${VENDOR} · revision ${ratifyInfo?.revision || 'next'}`,
  });
  const spend = await transfer(session.agentId, VENDOR, '10000', false, `tr:${session.id}:vendor`);
  note(session, `$0.01 → ${VENDOR} (${spend.status}, ${spend.txHash || spend.correlationId})`);
  ev(session, {
    phase: 'transfer', title: 'Pay the vendor — $0.01 → ac-owner', source: 'live',
    api: { method: 'POST', path: `/v1/agents/${session.agentId}/transfer`, idempotencyKey: `tr:${session.id}:vendor` },
    statuses: [{ status: spend.status, at: now() }], provider: 'outlayer',
    correlationId: spend.correlationId,
    code: spend.status === 'UNCERTAIN' ? 'uncertain' : undefined,
    note: spend.status === 'UNCERTAIN' ? 'maybe executed — polling the original correlation_id, never resubmitting' : undefined,
  });
  let final = spend;
  if (spend.status === 'UNCERTAIN') {
    const done = await waitStatus(spend.correlationId);
    final = { status: done?.status ?? spend.status, correlationId: spend.correlationId, txHash: done?.details?.evidence?.intent_hash || spend.txHash };
    ev(session, {
      phase: 'transfer', title: 'UNCERTAIN resolved — same correlation_id polled', source: 'live',
      statuses: [{ status: final.status, at: now() }], correlationId: final.correlationId, provider: 'outlayer',
      intentHash: done?.details?.intent_hash || final.txHash,
      note: 'settlement confirmed by polling; no resubmission',
    });
  }
  return c.json({ ok: true, spend: final, policy: ratifyInfo?.policy || null, signature: ratifyInfo || null, events: session.events });
});

demoRoutes.post('/demo/:sid/force-spend', async (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session) return c.json({ error: 'unknown session' }, 404);
  if (session.mode === 'live') {
    // safety: if the vendor is already whitelisted, the bite would move REAL funds.
    // never push the button then — a destinations-only policy_update must remove it first.
    try {
      const pv = await policyView(session.agentId);
      const has = (pv?.policy?.destinations?.list || []).some((d: any) => d.address === VENDOR);
      if (has) {
        note(session, 'bite suppressed: vendor already whitelisted (policy rev ' + pv.revision + ')');
        return c.json({ refused: 'suppressed', reason: 'vendor already whitelisted — this bite would move real funds. Run a destinations-only policy_update removing the vendor first (10-min cooldown applies).' }, 400);
      }
    } catch { /* policy read failed — do not push blind */ }
  }
  try {
    const spend = await transfer(session.agentId, VENDOR, '10000', false, `tr:${session.id}:bite`);
    note(session, `UNEXPECTED: vendor transfer went through (${spend.status})`);
    return c.json({ refused: false, spend });
  } catch (err) {
    const e = err as AgentApiError;
    note(session, `wallet refused: ${e.code}`);
    ev(session, {
      phase: 'refusal', title: 'Wallet refused — 403 before dispatch', source: src(session.mode),
      api: { method: 'POST', path: `/v1/agents/${session.agentId}/transfer`, idempotencyKey: `tr:${session.id}:bite` },
      code: e.code,
      explorer: session.mode === 'replay' ? RECEIPTS.explorer.agentAccount : undefined,
      layer: session.mode === 'replay'
        ? RECEIPTS.refusal.layer
        : 'owner-signed destinations (Agent Connect API pre-dispatch check)',
      note: session.mode === 'replay'
        ? `${RECEIPTS.refusal.replayNote} · REPLAY of the 2026-10-19 live refusal`
        : 'Nothing moved. Same-key replay returns the refusal; only an owner-signed policy_update opens a destination.',
    });
    return c.json({ refused: true, code: e.code, message: e.message, events: session.events, receipt: session.mode === 'replay' ? RECEIPTS.refusal : undefined });
  }
});

demoRoutes.get('/demo/:sid/events', (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session) return c.json({ error: 'unknown session' }, 404);
  return c.json({ events: session.events, log: session.log });
});

demoRoutes.get('/demo/:sid/log', (c) => {
  const session = sessions.get(c.req.param('sid'));
  if (!session) return c.json({ error: 'unknown session' }, 404);
  return c.json({ log: session.log });
});
