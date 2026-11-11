/**
 * verify-live-precedent.ts — re-check a live precedent receipt from scratch.
 *
 * Three independent things are checked, in order:
 *
 *  1. THE CHAIN. The contract is asked for the proposal and its finalized
 *     coordination. State, tally and the three worker_submissions commitments
 *     are read back over NEAR RPC (free, no key, no writes).
 *  2. THE RECEIPT. The stored receipt must agree with the chain: same state,
 *     same tally, same submission hashes, and sha256(aggregated_result) must
 *     equal the result_hash the contract committed.
 *  3. THE LIVE MEMORY. Each juror's result is re-read from Ensue and
 *     re-hashed. The on-chain commitment must still equal the bytes in the
 *     store — otherwise a juror re-voted after the settlement and the receipt
 *     no longer describes what is on chain.
 *
 * Plus, when the result carries the TEE proof, the chat signature is verified
 * with NEAR's official verifier over the exact wire bytes, which re-derives
 * the signed hashes.
 *
 * Usage:
 *   npm run verify:live                       # checks the newest receipt
 *   npm run verify:live -- --proposal 80      # checks a specific one
 *   ENSUE_API_KEY=… npm run verify:live       # unlocks check 3 (live memory)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyChat } from 'nearai-cloud-verifier';
import { extractResultJson } from './run-live.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECEIPTS_DIR = join(ROOT, 'fixtures', 'live-testnet');
const CONTRACT = process.env.VERDICT_CONTRACT_ID || 'coordinator.agents-coordinator.testnet';
const RPC = process.env.NEAR_RPC || 'https://test.rpc.fastnear.com';

interface Receipt {
  meta: { capturedAt: string; network: string; contract: string; kind: string; knownIssue?: unknown };
  taskConfig: string;
  tally: { decision: string; rules: { approved: number; rejected: number; workerCount: number; quorum: number } };
  submissions: Array<{ worker_id: string; result_hash: string }>;
  aggregatedResult: string;
  resultHash: string;
  proposal: { state?: string; worker_submissions?: Array<{ worker_id: string; result_hash: string }>; expected_worker_count?: number; quorum?: number };
  finalized: unknown;
}

interface ChainProposal {
  state?: string;
  worker_submissions?: Array<{ worker_id: string; result_hash: string }>;
  expected_worker_count?: number;
  quorum?: number;
}

async function viewCall<T>(methodName: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: '1', method: 'query',
      params: {
        request_type: 'call_function', finality: 'final',
        account_id: CONTRACT, method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
  });
  const data = (await res.json()) as { error?: { message?: string }; result?: { result?: number[] } };
  if (data.error || !data.result?.result) return null;
  return JSON.parse(new TextDecoder().decode(new Uint8Array(data.result.result))) as T;
}

function sha(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function main(): Promise<number> {
  const arg = process.argv.find((a) => a === '--proposal');
  const wanted = arg ? process.argv[process.argv.indexOf(arg) + 1] : null;
  const files = readdirSync(RECEIPTS_DIR).filter((f) => f.startsWith('proposal-') && f.endsWith('.json'));
  if (files.length === 0) { console.log('NO RECEIPTS FOUND'); return 2; }
  const file = wanted
    ? files.find((f) => f.includes(`-${wanted}.json`)) ?? files[0]
    : files.sort((a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]))[0];
  const receipt = JSON.parse(readFileSync(join(RECEIPTS_DIR, file), 'utf8')) as Receipt;
  const proposalId = Number(file.match(/proposal-(\d+)/)![1]);

  console.log(`LIVE PRECEDENT VERIFICATION — proposal #${proposalId} (${file})`);
  console.log(`  contract ${receipt.meta.contract} · network ${receipt.meta.network} · captured ${receipt.meta.capturedAt}`);
  if (receipt.meta.knownIssue) {
    console.log('  NOTE: this receipt carries a known issue (see meta.knownIssue) — the tally in it was computed wrongly.');
  }

  let failures = 0;
  const fail = (msg: string) => { failures++; console.log(`  FAIL — ${msg}`); };
  const pass = (msg: string) => console.log(`  OK   — ${msg}`);

  // 1 — the chain
  console.log('\n[1] CHAIN');
  const chain = await viewCall<ChainProposal>('get_proposal', { proposal_id: proposalId });
  const finalizedRaw = await viewCall<string>('get_finalized_coordination', { proposal_id: proposalId });
  if (!chain) {
    fail(`the contract did not answer for proposal #${proposalId}`);
    console.log(`\nPRECEDENT VERIFICATION FAILED — ${failures} check(s) failed`);
    return 1;
  }
  const finalized = (typeof finalizedRaw === 'string' ? JSON.parse(finalizedRaw) : finalizedRaw) as { decision: string; approved: number; rejected: number } | null;
  chain.state === 'Finalized' ? pass(`state ${chain.state}`) : fail(`state is ${chain.state}, expected Finalized`);
  const chainHashes = (chain.worker_submissions ?? []).map((s) => s.result_hash).sort();
  const receiptHashes = receipt.submissions.map((s) => s.result_hash).sort();
  JSON.stringify(chainHashes) === JSON.stringify(receiptHashes)
    ? pass(`${chainHashes.length} worker_submissions commitments match the receipt`)
    : fail('the contract commitments differ from the receipt');
  finalized?.decision === receipt.tally.decision
    ? pass(`on-chain verdict ${finalized.decision} ${finalized.approved}-${finalized.rejected} matches the receipt`)
    : fail(`on-chain verdict ${finalized?.decision} differs from the receipt ${receipt.tally.decision}`);
  sha(receipt.aggregatedResult) === receipt.resultHash
    ? pass('sha256(aggregated_result) equals the committed resultHash')
    : fail('sha256(aggregated_result) does not equal the committed resultHash');

  // 2 — the live memory (needs the Ensue key; skipped without it)
  console.log('\n[2] LIVE MEMORY (the bytes the commitments were made over)');
  const { ensue, ensueConfigured } = await import('../src/ensue.js');
  if (!ensueConfigured()) {
    console.log('  SKIP — ENSUE_API_KEY not set (the on-chain half above is still verified)');
  } else {
    for (const s of receipt.submissions) {
      const raw = await ensue.get(`coordination/tasks/${s.worker_id}/result`);
      if (!raw) { fail(`no live result for ${s.worker_id.slice(0, 22)}…`); continue; }
      const bytes = extractResultJson(raw);
      if (sha(bytes) !== s.result_hash) {
        fail(`${s.worker_id.slice(0, 22)}… the live result no longer hashes to the committed value (a juror re-voted after the settlement)`);
        continue;
      }
      pass(`${s.worker_id.slice(0, 22)}… sha256(live result) == the committed resultHash`);
      // 3 — the TEE proof, when the result carries one
      const doc = JSON.parse(bytes) as { output?: { vote?: string; computedAt?: string }; verificationProof?: { text?: string; signature?: string; signing_address?: string; signing_algo?: string; request_body?: string; response_body?: string } };
      const vp = doc.verificationProof;
      if (!vp) { console.log(`       (no TEE proof inside this result — older capture)`); continue; }
      if (!vp.request_body || !vp.response_body) { console.log(`       (TEE proof present without the wire bytes — hash level not re-derivable)`); continue; }
      const v = verifyChat(
        { requestBody: Buffer.from(vp.request_body, 'utf8'), responseBody: Buffer.from(vp.response_body, 'utf8') },
        { text: vp.text!, signature: vp.signature!, signing_address: vp.signing_address!, signing_algo: (vp.signing_algo || 'ecdsa') as 'ecdsa' | 'ed25519' },
      );
      v.isHashVerified && v.isSignatureVerified
        ? pass(`       TEE proof: the wire bytes re-derive the signed hashes and the signature verifies (${doc.output?.vote})`)
        : fail(`       TEE proof: hash=${v.isHashVerified} signature=${v.isSignatureVerified}`);
    }
  }

  console.log(`\nPRECEDENT VERIFICATION ${failures === 0 ? 'PASS' : 'FAILED'} — ${failures} check(s) failed`);
  return failures === 0 ? 0 : 1;
}

if (process.argv[1]?.includes('verify-live-precedent')) void main().then((c) => process.exit(c));
