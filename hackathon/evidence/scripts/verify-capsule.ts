/**
 * verify-capsule.ts — re-derives every digest in the evidence capsule from the
 * committed fixture bytes and fails on any mismatch. Same checks as the future
 * browser verify.html (day 3) — this is its CLI twin.
 *
 * Run: npm run verify:capsule   → CAPSULE VERIFIED / CAPSULE FAILED
 */
import { buildCapsule, fixtureDigest } from '../src/capsule.js';
import { loadProposal74, loadReceipt } from '../src/verdict-fixture.js';

let ok = true;
const fail = (label: string, detail = '') => { ok = false; console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); };
const pass = (label: string) => console.log(`PASS  ${label}`);

try {
  const capsule = buildCapsule();
  pass(`spec ${capsule.spec}, ${capsule.fixtures.length} fixtures digested`);

  for (const d of capsule.fixtures) {
    const name = d.file.replace(/^fixtures\//, '');
    const fresh = fixtureDigest(name);
    if (!fresh) { fail(`recompute ${d.file}`, 'fixture file missing'); continue; }
    (fresh.sha256 === d.sha256 && fresh.bytes === d.bytes) ? pass(`digest ${d.file}`) : fail(`digest ${d.file}`);
  }

  const p74 = loadProposal74();
  (capsule.totals.verdict.decision === p74.tally.decision && capsule.totals.verdict.approved === p74.tally.approved)
    ? pass('verdict totals match fixture') : fail('verdict totals drift');

  const approved = loadReceipt('receipt-approved.json');
  capsule.totals.oraclePaymentAtomic === approved.oraclePayment.amountAtomic && capsule.totals.vendorPaymentAtomic === approved.vendorPayment.amountAtomic
    ? pass('payment totals match fixture ($0.01 / $0.01 atomic)') : fail('payment totals drift');

  if (/^[a-f0-9]{64}$/.test(p74.jurors[0].resultHash) && p74.jurors.length === 3) pass('juror resultHashes present (reasoning sealed by design)');
  else fail('juror resultHashes malformed');

  console.log(ok ? '\nCAPSULE VERIFIED — offline, no keys, byte-linked to fixtures' : '\nCAPSULE FAILED');
} catch (e: unknown) {
  fail('capsule build/verify', e instanceof Error ? e.message : String(e));
}
process.exit(ok ? 0 : 1);
