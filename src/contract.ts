/**
 * contract.ts — settlement seam (PORT of Delibera src/contract/local-contract.ts
 * trimmed to the jury loop: start -> record submissions -> resume).
 *
 * CONTRACT STATUS: `coordinator.agents-coordinator.near` is wired mainnet here
 * but was only testnet-proven in the original runs. `npm run verify:settlement`
 * (view call, no gas) must confirm the mainnet deployment BEFORE any settle
 * claim is written into the demo/README. The day-2 precedent run settles a real
 * deliberation mainnet and its receipt goes to fixtures/.
 *
 * Secrets: the seed phrase comes from env at run time only (never committed
 * here). Owner signing may prefer the keychain path like client.ts — decide at
 * the gated run; the original pattern (env seed phrase) is kept for parity.
 */
import { connect, keyStores, KeyPair, Account } from 'near-api-js';
import { parseSeedPhrase } from 'near-seed-phrase';

/* Config read at CALL time — run-live fills envs (env file) after imports. */
export const nearNetwork = () => process.env.NEAR_NETWORK || 'testnet';
export const contractId = () =>
  process.env.VERDICT_CONTRACT_ID ||
  (nearNetwork() === 'mainnet' ? 'coordinator.agents-coordinator.near' : 'coordinator.agents-coordinator.testnet');
export const signerId = () =>
  process.env.NEAR_ACCOUNT_ID ||
  (nearNetwork() === 'mainnet' ? 'agents-coordinator.near' : 'agents-coordinator.testnet');
export const nearRpc = () =>
  process.env.NEAR_RPC_JSON ||
  (nearNetwork() === 'mainnet' ? 'https://rpc.mainnet.fastnear.com' : 'https://test.rpc.fastnear.com');


const GAS_100T = '100000000000000';
const GAS_200T = '200000000000000';

let _account: Account | null = null;

async function getAccount(): Promise<Account> {
  if (_account) return _account;
  const seedPhrase = process.env.NEAR_SEED_PHRASE || '';
  if (!seedPhrase) throw new Error('NEAR_SEED_PHRASE is required for contract change calls (keep it in .env, never in the repo)');
  const { secretKey } = parseSeedPhrase(seedPhrase);
  const keyStore = new keyStores.InMemoryKeyStore();
  // parseSeedPhrase yields the raw base58 secret; near-api-js v5 wants the
  // ed25519:-prefixed branded string.
  const kpStr = (secretKey.startsWith('ed25519:') ? secretKey : `ed25519:${secretKey}`) as `ed25519:${string}`;
  const net = nearNetwork();
  const id = signerId();
  await keyStore.setKey(net, id, KeyPair.fromString(kpStr));
  const near = await connect({ networkId: net, keyStore, nodeUrl: nearRpc() });
  _account = await near.account(id);
  return _account;
}

/** View call — no signing, no gas. Free. */
export async function viewCall<T>(methodName: string, args: Record<string, unknown>, cid = contractId(), endpoint = nearRpc()): Promise<T | null> {
  if (cid === undefined || endpoint === undefined) throw new Error('offline contract config unavailable');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: cid,
          method_name: methodName,
          args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
        },
      }),
    });
    // NEAR RPC JSON boundary (trusted, read-only view call).
    const data = (await res.json()) as { error?: { message?: string }; result?: { result?: number[] } };
    if (data.error || !data.result?.result) return null;
    const text = new TextDecoder().decode(new Uint8Array(data.result.result));
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function changeCall(methodName: string, args: Record<string, unknown>, gas = GAS_200T): Promise<unknown> {
  const account = await getAccount();
  return account.functionCall({
    contractId: contractId(),
    methodName,
    args,
    gas: BigInt(gas),
    attachedDeposit: BigInt(0),
  });
}

/** Create the verification task on-chain. Returns the new proposal id.
 * Fire-and-forget BY DESIGN (matches the ported baseline): start_coordination
 * opens the proposal via promise_yield_create (synchronous part) and blocks
 * awaiting coordinator_resume — awaiting finality here would deadlock until
 * resume. Only the proposal's EXISTENCE matters; the background call's errors
 * are surfaced as warnings, not swallowed. */
export async function startCoordination(taskConfig: string, expectedWorkerCount = 3, quorum = 2): Promise<number | null> {
  const beforeId = (await viewCall<number>('get_current_proposal_id', {})) ?? 0;
  changeCall('start_coordination', { task_config: taskConfig, expected_worker_count: expectedWorkerCount, quorum }).catch(
    (e: unknown) => console.warn(`[contract] start_coordination background: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`),
  );
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const afterId = (await viewCall<number>('get_current_proposal_id', {})) ?? 0;
    if (afterId > beforeId) return afterId;
  }
  return null;
}

/** Nullifier pattern: on-chain commits { worker_id, sha256(result_json) } per juror. */
export async function recordWorkerSubmissions(
  proposalId: number,
  submissions: Array<{ worker_id: string; result_hash: string }>,
): Promise<boolean> {
  try {
    await changeCall('record_worker_submissions', { proposal_id: proposalId, submissions }, GAS_100T);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('timeout')) {
      console.warn(`[contract] record_worker_submissions: ${msg.slice(0, 300)}`);
      return false;
    }
    // yield/resume can time the waiter out while the tx lands — verify by state.
    await new Promise((r) => setTimeout(r, 3000));
    const proposal = await viewCall<{ state?: string }>('get_proposal', { proposal_id: proposalId });
    return proposal?.state === 'WorkersCompleted';
  }
}

/** Settlement: aggregate verdict + hashes finalized on-chain. */
export async function coordinatorResume(proposalId: number, aggregatedResult: string, configHash: string, resultHash: string): Promise<boolean> {
  try {
    await changeCall('coordinator_resume', { proposal_id: proposalId, aggregated_result: aggregatedResult, config_hash: configHash, result_hash: resultHash }, GAS_100T);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('timeout')) {
      console.warn(`[contract] coordinator_resume: ${msg.slice(0, 300)}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 5000));
    const finalized = await viewCall<string>('get_finalized_coordination', { proposal_id: proposalId });
    if (finalized) return true;
    const pending = await viewCall<Array<[number, unknown]>>('get_pending_coordinations', { from_index: null, limit: null });
    return !pending?.some(([id]) => id === proposalId);
  }
}
