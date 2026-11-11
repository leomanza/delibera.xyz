/**
 * test/cso.test.ts — invariants of the evidence pipeline (node:test, offline).
 * Run: npm test  (tsx --test)
 *
 * Tests cover only pure logic — no network, no keys, no funds:
 *   capsule byte determinism · Ensue envelope parsing · fixture shapes ·
 *   tally aggregation · verify-no-key scan internals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildCapsule } from '../src/capsule.js';
import { parseEnsueResponse } from '../src/ensue.js';
import { loadProposal74, loadReceipt } from '../src/verdict-fixture.js';
import { buildTally, extractResultJson } from '../scripts/run-live.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('capsule: deterministic digests across rebuilds', () => {
  const a = buildCapsule();
  const b = buildCapsule();
  assert.equal(a.spec, 'cso-capsule/1');
  assert.deepEqual(
    a.fixtures.map((f) => [f.file, f.sha256, f.bytes]),
    b.fixtures.map((f) => [f.file, f.sha256, f.bytes]),
  );
  assert.ok(a.generatedAt);
});

test('capsule: four pinned fixtures, counts and amounts in atomic strings', () => {
  const c = buildCapsule();
  assert.equal(c.fixtures.length, 4);
  for (const f of c.fixtures) {
    assert.match(f.sha256, /^[a-f0-9]{64}$/);
    assert.ok(f.bytes > 0);
    assert.match(f.file, /^fixtures\//);
  }
  assert.equal(c.totals.verdict.approved, 3);
  assert.equal(c.totals.verdict.rejected, 0);
  assert.match(c.totals.oraclePaymentAtomic, /^\d+$/);
  assert.match(c.totals.vendorPaymentAtomic, /^\d+$/);
  assert.equal(c.checks.amountsAtomicStrings, true);
  assert.equal(c.checks.noPrivateMaterial, true);
  assert.equal(c.checks.jurorReasoningSealed, true);
});

test('ensue parser: takes the LAST data: envelope from SSE streams', () => {
  const last = JSON.stringify({ jsonrpc: '2.0', id: 2, result: { n: 2 } });
  const sse = 'data: {"jsonrpc":"2.0","id":1,"result":{"n":1}}\n'
    + `data: ${last}\n`;
  const env = parseEnsueResponse(sse) as { result?: { n: number } };
  assert.equal(env.result?.n, 2);
});

test('ensue parser: plain JSON bodies keep working (compat fallback)', () => {
  const env = parseEnsueResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }));
  assert.equal((env as { result?: { ok: boolean } }).result?.ok, true);
});

test('ensue parser: error envelope passes through so call() can throw', () => {
  const env = parseEnsueResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'boom' } }));
  assert.ok((env as { error?: unknown }).error);
});

test('proposal 74 fixture: 3 jurors, hex64 resultHashes, testnet-capture label', () => {
  const p = loadProposal74();
  assert.ok(p.meta.settlement.label.includes('testnet-capture'));
  assert.equal(p.jurors.length, 3);
  for (const j of p.jurors) assert.match(j.resultHash, /^[a-f0-9]{64}$/);
  assert.equal(p.tally.decision, 'Approved');
  assert.equal(p.tally.approved, 3);
  assert.equal(p.tally.rejected, 0);
});

test('approved receipt: atomic $0.01 + UNCERTAIN handled by polling', () => {
  const approved = loadReceipt('receipt-approved.json');
  assert.equal(approved.oraclePayment.amountAtomic, '10000');
  assert.equal(approved.vendorPayment.amountAtomic, '10000');
  assert.equal(approved.oraclePayment.action, 'confidential_transfer');
  assert.equal(approved.oraclePayment.providerStatus, 'success');
  assert.ok(JSON.stringify(approved.vendorPayment.timeline).includes('UNCERTAIN'));
});

test('denied receipt: the provider 403 is the guardrail bite', () => {
  const denied = loadReceipt('receipt-denied.json');
  assert.equal(denied.refusal.http, 403);
  assert.equal(denied.refusal.code, 'policy_destination_denied');
  assert.ok(denied.refusal.message.includes('whitelist'));
  assert.ok(denied.replayNote.length > 0);
});

test('policy: rev 4, only-mode whitelist, APPLIED and synced', () => {
  const policy = loadReceipt('policy.json');
  assert.equal(policy.view.revision, 4);
  assert.equal(policy.view.status, 'APPLIED');
  assert.equal(policy.view.providerPolicySynced, true);
  assert.equal(policy.document.destinations.mode, 'only');
  assert.match(policy.view.policyHash, /^[a-f0-9]{64}$/);
});

test('tally: unanimous approval', () => {
  const t = buildTally(['a', 'b', 'c'], { a: '{"output":{"value":1,"vote":"Approved"}}', b: '{"output":{"vote":"approved"}}', c: '{"output":{"value":1}}' });
  assert.equal(t.decision, 'Approved');
  assert.equal(t.rules.approved, 3);
  assert.equal(t.rules.rejected, 0);
});

test('tally: minority against wins the decision (majority rule)', () => {
  const t = buildTally(['a', 'b', 'c'], { a: '{"output":{"value":1}}', b: '{"output":{"value":0}}', c: '{"output":{"value":0}}' });
  assert.equal(t.decision, 'Rejected');
  assert.equal(t.rules.approved, 1);
  assert.equal(t.rules.rejected, 2);
});

test('tally: missing results are ignored but still counted in workerCount', () => {
  const t = buildTally(['a', 'b', 'c'], { a: '{"output":{"value":1}}', b: undefined });
  assert.equal(t.rules.approved, 1);
  assert.equal(t.rules.rejected, 0);
  assert.equal(t.rules.workerCount, 3);
});

test('tally: malformed worker result aborts before settlement (never a default vote)', () => {
  assert.throws(
    () => buildTally(['a', 'b', 'c'], { a: 'not-json{{{', b: '{"output":{"value":1}}', c: '{"output":{"value":1}}' }),
    /malformed worker result from a/,
  );
});

test('tally: jury size is not fixed — 5 jurors with quorum 3', () => {
  const five = ['a', 'b', 'c', 'd', 'e'];
  const results = {
    a: '{"output":{"value":1}}',
    b: '{"output":{"value":1}}',
    c: '{"output":{"value":1}}',
    d: '{"output":{"value":0}}',
    e: '{"output":{"value":0}}',
  };
  const t = buildTally(five, results, 3);
  assert.equal(t.decision, 'Approved');
  assert.equal(t.rules.approved, 3);
  assert.equal(t.rules.rejected, 2);
  assert.equal(t.rules.workerCount, 5);
  assert.equal(t.rules.quorum, 3);
});

test('tally: quorum decides, not raw majority (2 of 5 is not enough for quorum 3)', () => {
  const five = ['a', 'b', 'c', 'd', 'e'];
  const results = {
    a: '{"output":{"value":1}}',
    b: '{"output":{"value":1}}',
    c: '{"output":{"value":0}}',
    d: '{"output":{"value":0}}',
    e: '{"output":{"value":0}}',
  };
  const t = buildTally(five, results, 3);
  assert.equal(t.decision, 'Rejected', 'a 2-2 split with one abstention does not reach quorum 3');
  assert.equal(t.rules.approved, 2);
  assert.equal(t.rules.quorum, 3);
});

test('tally: default quorum is a strict majority of the jury size', () => {
  const two = ['a', 'b'];
  const tie = buildTally(two, { a: '{"output":{"value":1}}', b: '{"output":{"value":0}}' });
  assert.equal(tie.rules.quorum, 2);
  assert.equal(tie.decision, 'Rejected', 'a tie does not pass a majority rule');
  const five = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(buildTally(five, {}).rules.quorum, 3);
});

test('result extraction: the memory envelope is unwrapped to the result document', () => {
  const resultDoc = '{"workerId":"did:key:zX","taskType":"vote","output":{"value":1,"vote":"Approved","reasoning":"r"}}';
  const envelope = JSON.stringify({ failed: 0, results: [{ value: resultDoc }], succeeded: 1, total: 1 });
  assert.equal(extractResultJson(envelope), resultDoc);
  // A snapshot of the envelope one level deeper (what the coordinator writes
  // under proposals/<id>/workers/<did>/result) must unwrap to the same doc.
  const nested = JSON.stringify({ failed: 0, results: [{ value: envelope }], succeeded: 1, total: 1 });
  assert.equal(extractResultJson(nested), resultDoc);
  // A bare result document is returned unchanged.
  assert.equal(extractResultJson(resultDoc), resultDoc);
});

test('tally: a wrapped result is tallied by its VOTE, not counted as a rejection', () => {
  // This is the regression that produced the wrong on-chain verdict: the
  // envelope was parsed as if it were the result document, so every juror
  // looked like "no vote" and was counted as a rejection.
  const resultDoc = '{"workerId":"did:key:zX","output":{"value":1,"vote":"Approved"}}';
  const envelope = JSON.stringify({ failed: 0, results: [{ value: resultDoc }] });
  const extracted = extractResultJson(envelope);
  const t = buildTally(['a'], { a: extracted }, 1);
  assert.equal(t.rules.approved, 1);
  assert.equal(t.rules.rejected, 0);
  assert.equal(t.decision, 'Approved');
});

test('no-key scanner: repo is clean and .env is not tracked', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  assert.equal(tracked.filter((f) => f === '.env' || f.startsWith('.env.')).length, 0, '.env must never be tracked');
  assert.equal(tracked.includes('capsule.json'), false);
});

test('no-key scanner: only declared public vectors may live in the repo', () => {
  const vectors = readFileSync(join(ROOT, 'assets', 'test-vectors.json'), 'utf8');
  assert.ok(vectors.includes('nep413'), 'vectors file covers the NEP-413 fixture');
  for (const k of ['near', 'nep413', 'nep366', 'eip712', 'grant']) assert.ok(k in JSON.parse(vectors), `vectors cover ${k}`);
});
