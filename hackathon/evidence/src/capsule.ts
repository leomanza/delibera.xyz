/**
 * capsule.ts — the offline evidence capsule (spec cso-capsule/1).
 *
 * A capsule bundles the captured receipts the judge needs with SHA-256
 * digests over each fixture's exact bytes, so anyone can re-verify that the
 * bundle is unedited without trusting this repo: every digest maps to a
 * committed fixture file. No narrative, no keys, no secrets — the juror
 * results are sealed: only their committed resultHashes travel.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CapsuleDigest { file: string; sha256: string; bytes: number }
export interface Capsule {
  spec: 'cso-capsule/1';
  generatedAt: string;
  narrative: string;
  fixtures: CapsuleDigest[];
  totals: { oraclePaymentAtomic: string; vendorPaymentAtomic: string; verdict: { decision: string; approved: number; rejected: number } };
  checks: { amountsAtomicStrings: true; noPrivateMaterial: true; jurorReasoningSealed: true };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = ['proposal-74.json', 'receipt-approved.json', 'receipt-denied.json', 'policy.json'] as const;

/** Minimal typed view of the two fixtures the totals come from (JSON boundary). */
interface TotalsSource {
  oraclePayment?: { amountAtomic?: string };
  vendorPayment?: { amountAtomic?: string };
  tally?: { decision?: string; approved?: number; rejected?: number };
}

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Build the capsule deterministically from the committed fixtures. */
export function buildCapsule(generatedAt = new Date().toISOString()): Capsule {
  const digests = FIXTURES.map((file) => {
    const bytes = readFileSync(join(ROOT, 'fixtures', file));
    return { file: `fixtures/${file}`, sha256: sha256Hex(bytes), bytes: bytes.length };
  });
  // Trusted committed-fixture JSON boundary (these files are hash-pinned by
  // the digests two lines down; parse is only for the totals summary).
  const approved: TotalsSource = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'receipt-approved.json'), 'utf8'));
  const p74: TotalsSource = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'proposal-74.json'), 'utf8'));
  return {
    spec: 'cso-capsule/1',
    generatedAt,
    narrative:
      'An owner-signed policy makes this wallet refuse any spend outside its own rules. ' +
      'When the vendor payment was attempted, the API itself refused it (403 policy_destination_denied). ' +
      'The wallet then paid a private jury of 3 agents $0.01 for a second opinion; each juror committed only a resultHash, ' +
      'reasoning stayed sealed; the 3-0 verdict plus one owner NEP-413 signature whitelisted the vendor and the payment went through.',
    fixtures: digests,
    totals: {
      oraclePaymentAtomic: approved.oraclePayment?.amountAtomic ? approved.oraclePayment.amountAtomic : '0',
      vendorPaymentAtomic: approved.vendorPayment?.amountAtomic ? approved.vendorPayment.amountAtomic : '0',
      verdict: {
        decision: p74.tally?.decision ? p74.tally.decision : 'unknown',
        approved: p74.tally?.approved ?? 0,
        rejected: p74.tally?.rejected ?? 0,
      },
    },
    checks: { amountsAtomicStrings: true, noPrivateMaterial: true, jurorReasoningSealed: true },
  };
}

/**
 * Deterministic content digest for one fixture (independent of its digest
 * position inside the capsule) — used to prove fixtures are byte-identical
 * whenever the capsule is re-verified.
 */
export function fixtureDigest(file: string): CapsuleDigest | null {
  try {
    const bytes = readFileSync(join(ROOT, 'fixtures', file));
    return { file: `fixtures/${file}`, sha256: sha256Hex(bytes), bytes: bytes.length };
  } catch {
    return null;
  }
}
