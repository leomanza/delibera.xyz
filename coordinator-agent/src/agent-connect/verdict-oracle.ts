/**
 * verdict-oracle.ts — BFF endpoint: the Delibera verdict oracle as a service.
 *
 * POST /agent-connect/verdict  { proposal: string }
 *   → 202 { verdictId }         (deliberation started)
 * GET  /agent-connect/verdict/:id
 *   → 200 { verdict card }      (or 202 while deliberating)
 *
 * This is the seam the Agent Connect demo (and later any buyer) calls. The
 * verdict engine is the proven local flow (trigger → workers → tally →
 * on-chain settlement) — untouched.
 *
 * WATCHER (real-money seam, behind flag): in a later iteration the oracle
 * account's inbound Agent Connect transfers are matched to verdict requests
 * (payment → deliberation). For now the endpoint is open — the demo authorizes
 * via the wallet policy, not here.
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';

const COORDINATOR_BASE = `http://localhost:${process.env.PORT || 3000}`;

export interface VerdictRecord {
  id: string;
  proposal: string;
  state: 'deliberating' | 'completed' | 'failed';
  createdAt: string;
  tally?: any;
  proposalId?: number;
  error?: string;
}

const verdicts = new Map<string, VerdictRecord>();

export function getVerdictRecord(id: string): VerdictRecord | undefined {
  return verdicts.get(id);
}

export function startDeliberation(proposal: string): VerdictRecord {
  const record: VerdictRecord = {
    id: `v_${randomUUID().slice(0, 8)}`,
    proposal: proposal.slice(0, 4000),
    state: 'deliberating',
    createdAt: new Date().toISOString(),
  };
  verdicts.set(record.id, record);
  runDeliberation(record); // background; poll GET /verdict/:id
  return record;
}

async function runDeliberation(record: VerdictRecord) {
  try {
    await fetch(`${COORDINATOR_BASE}/api/coordinate/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskConfig: {
          type: 'vote',
          parameters: { proposal: record.proposal, voting_config: { min_workers: 3, quorum: 2 } },
        },
      }),
    });
    const deadline = Date.now() + 240_000;
    let consecutivePollErrors = 0;
    for (;;) {
      await new Promise((r) => setTimeout(r, 5_000));
      let s: any = null;
      try {
        s = await (await fetch(`${COORDINATOR_BASE}/api/coordinate/status`)).json();
        consecutivePollErrors = 0;
      } catch {
        consecutivePollErrors += 1; // transient (boot races, socket blips) — tolerate
        if (consecutivePollErrors >= 6) throw new Error('coordinator unreachable');
      }
      if (s?.status === 'completed' && s?.tally) {
        record.state = 'completed';
        record.tally = s.tally;
        record.proposalId = s.proposalId;
        return;
      }
      if (s?.status === 'failed') throw new Error('local coordination failed');
      if (Date.now() > deadline) throw new Error('deliberation timed out');
    }
  } catch (err) {
    record.state = 'failed';
    record.error = (err as Error).message;
  }
}

export const verdictOracle = new Hono();

verdictOracle.post('/verdict', async (c) => {
  const body = await c.req.json().catch(() => null);
  const proposal = body?.proposal?.trim();
  if (!proposal || proposal.length < 10) {
    return c.json({ error: 'proposal is required (min 10 chars)' }, 400);
  }
  const record = startDeliberation(proposal);
  return c.json({ verdictId: record.id, state: record.state }, 202);
});

verdictOracle.get('/verdict/:id', (c) => {
  const record = verdicts.get(c.req.param('id'));
  if (!record) return c.json({ error: 'unknown verdict id' }, 404);
  if (record.state === 'deliberating') {
    return c.json({ verdictId: record.id, state: record.state }, 202);
  }
  if (record.state === 'failed') {
    return c.json({ verdictId: record.id, state: 'failed', error: record.error }, 500);
  }
  const t = record.tally;
  return c.json({
    verdictId: record.id,
    state: 'completed',
    decision: t.decision,
    approved: t.approved,
    rejected: t.rejected,
    workerCount: t.workerCount,
    proposalId: record.proposalId,
    settledOn: 'coordinator.agents-coordinator.testnet',
    timestamp: t.timestamp,
    jurors: (t.workers || []).map((w: any) => ({
      name: t.workerNames?.[w.workerId] || w.workerId,
      vote: w.output?.vote,
      reasoning: w.output?.reasoning,
    })),
  });
});
