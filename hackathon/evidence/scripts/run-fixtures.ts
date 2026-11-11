/**
 * run-fixtures.ts — validates the captured fixtures: shapes, tally math,
 * hashes, honesty labels. Offline pass: no network, no keys, no funds.
 *
 * Run: npm run fixtures
 */
import { loadProposal74, loadReceipt } from '../src/verdict-fixture.js';

let ok = true;
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : ` — ${detail}`}`);
  if (!cond) ok = false;
}

const p = loadProposal74();
check('verdict #74 kept: 3-0 Approved', p.tally.decision === 'Approved' && p.tally.approved === 3 && p.tally.rejected === 0);
check('three jurors with 64-hex resultHash commits', p.jurors.length === 3 && p.jurors.every((j) => /^[a-f0-9]{64}$/.test(j.resultHash)));
check('resultHashes are distinct', new Set(p.jurors.map((j) => j.resultHash)).size === 3);
check('votes all Approved', p.jurors.every((j) => j.vote === 'Approved'));
check('settlement honestly labeled testnet-capture', /testnet-capture/.test(p.meta.settlement.label));

const approved = loadReceipt('receipt-approved.json');
check('oracle payment $0.01 (confidential_transfer)', approved.oraclePayment.amountAtomic === '10000' && approved.oraclePayment.action === 'confidential_transfer');
check('vendor payment $0.01 SUCCESS after poll', approved.vendorPayment.amountAtomic === '10000' && approved.vendorPayment.providerStatus === 'success');
check('UNCERTAIN was handled by polling', JSON.stringify(approved.vendorPayment.timeline).includes('UNCERTAIN'));
check('nep413 owner signature evidence present', approved.signature.standard === 'nep413' && approved.signature.tag === '2147484061');

const denied = loadReceipt('receipt-denied.json');
check('refusal is provider 403 policy_destination_denied', denied.refusal.http === 403 && denied.refusal.code === 'policy_destination_denied');
check('refusal names the whitelist as the gate', denied.refusal.message.includes('whitelist'));

const policy = loadReceipt('policy.json');
check('policy rev 4 APPLIED + providerPolicySynced', policy.view.revision === 4 && policy.view.status === 'APPLIED' && policy.view.providerPolicySynced === true);
check('policy is only-mode whitelist (the gate)', policy.document.destinations.mode === 'only');
check('policy hash present for verification', /^[a-f0-9]{64}$/.test(policy.view.policyHash));

console.log(ok ? '\nFIXTURES OK — captured evidence coherent, fully offline' : '\nFIXTURES FAILED — see above');
if (!ok) process.exit(1);
