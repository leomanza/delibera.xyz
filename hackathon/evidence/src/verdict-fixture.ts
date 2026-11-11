/**
 * verdict-fixture.ts — replay of the verdict oracle from captured fixtures.
 * PORT of Delibera coordinator-agent/src/agent-connect/demo-routes.ts (verdict
 * card + receipt shapes). Fixtures are real captured receipts; per-juror
 * reasoning shown live in the original run stays sealed — the resultHash
 * commits are the on-chain evidence. No network, no keys, no funds.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export interface FixtureJuror { name: string; did: string; resultHash: string; vote: string }
export interface Proposal74 {
  meta: { capturedAt: string; settlement: { contract: string; label: string }; paymentRail: string; source: string };
  proposal: { proposalId: number; text: string };
  tally: { state: string; decision: string; approved: number; rejected: number; workerCount: number; quorum: number; minWorkers: number; settledAt: string };
  jurors: FixtureJuror[];
  note: string;
}

export function loadProposal74(): Proposal74 {
  return JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'proposal-74.json'), 'utf8'));
}

// Trusted committed-fixture JSON boundary: these files are hash-pinned by the
// capsule (src/capsule.ts) and their shape is pinned by the capture date
// 2026-10-19. Shapes below cover the fields consumers actually read.

export interface ReceiptApprovedDoc {
  signature: { message: string; standard: string; tag: string };
  oraclePayment: {
    action: string;
    amountAtomic: string;
    provider: string;
    providerStatus: string;
    intentHash: string;
    timeline: Array<{ status: string; label?: string }>;
  };
  vendorPayment: {
    action: string;
    amountAtomic: string;
    providerStatus: string;
    correlationId: string;
    timeline: Array<{ status: string; label?: string }>;
  };
}

export interface ReceiptDeniedDoc {
  meta: { label: string };
  refusal: { http: number; code: string; layer: string; message: string; replayNote: string };
}

export interface PolicyDoc {
  view: { revision: number; status: string; providerPolicySynced: boolean; policyHash: string };
  document: { destinations: { mode: string } };
  postRatification: { destinationsAdded: string[] };
}

export function loadReceipt(name: 'receipt-approved.json'): ReceiptApprovedDoc;
export function loadReceipt(name: 'receipt-denied.json'): ReceiptDeniedDoc;
export function loadReceipt(name: 'policy.json'): PolicyDoc;
export function loadReceipt(name: string): ReceiptApprovedDoc | ReceiptDeniedDoc | PolicyDoc {
  return JSON.parse(readFileSync(join(HERE, '..', 'fixtures', name), 'utf8'));
}

/** The verdict card the judge's screen shows (Delibera demo contract shape). */
export function verdictCard(p: Proposal74) {
  return {
    verdictId: `proposal-${p.proposal.proposalId}`,
    state: p.tally.state,
    decision: p.tally.decision,
    approved: p.tally.approved,
    rejected: p.tally.rejected,
    workerCount: p.tally.workerCount,
    quorum: p.tally.quorum,
    settledOn: p.meta.settlement.contract,
    settledAt: p.tally.settledAt,
    jurors: p.jurors.map((j) => ({ name: j.name, vote: j.vote, resultHash: j.resultHash })),
  };
}
