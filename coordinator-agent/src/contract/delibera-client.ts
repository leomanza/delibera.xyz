/**
 * NEAR client for Delibera coordinator contract calls.
 *
 * Background: ShadeClient (from @neardefi/shade-agent-js) is hard-wired to a single
 * AGENT_CONTRACT_ID — and that AGENT_CONTRACT_ID now points at our shade-contract-template
 * instance (agent-registry.agents-coordinator.testnet), NOT at Delibera's coordinator
 * contract. Per the coordinator architecture spec
 * (doc/plans/coordinator-architecture/00-spec.md, Q2=(a)), Delibera business-logic
 * calls go through this client instead — using near-api-js with the SAME agent
 * account that ShadeClient registered with the agent-registry contract.
 */
import { connect, keyStores, KeyPair, Account } from 'near-api-js';
import { getAgent } from '../shade-client';

const NETWORK_ID = (process.env.NEAR_NETWORK || 'testnet') as 'testnet' | 'mainnet';
const COORDINATOR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_contractId ||
  (NETWORK_ID === 'mainnet'
    ? 'coordinator.agents-coordinator.near'
    : 'coordinator.agents-coordinator.testnet');
const NEAR_RPC =
  process.env.NEAR_RPC_JSON ||
  (NETWORK_ID === 'mainnet'
    ? 'https://rpc.fastnear.com'
    : 'https://test.rpc.fastnear.com');

let _account: Account | null = null;

async function getAccount(): Promise<Account> {
  if (_account) return _account;

  const agent = getAgent();
  const accountId = agent.accountId();
  const [privateKey] = agent.getPrivateKeys({ acknowledgeRisk: true });

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(privateKey as any);
  await keyStore.setKey(NETWORK_ID, accountId, keyPair);

  const near = await connect({
    networkId: NETWORK_ID,
    keyStore,
    nodeUrl: NEAR_RPC,
  });
  _account = await near.account(accountId);
  return _account;
}

const GAS_300T = BigInt('300000000000000');
const GAS_200T = BigInt('200000000000000');

/**
 * View call against the Delibera coordinator contract. Uses NEAR RPC directly
 * (no signing needed for view calls).
 */
export async function deliberaView<T>(
  methodName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(NEAR_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'view',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: COORDINATOR_CONTRACT_ID,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      },
    }),
  });
  const data = (await res.json()) as {
    error?: unknown;
    result?: { result: number[] };
  };
  if (data.error) {
    throw new Error(`deliberaView ${methodName} failed: ${JSON.stringify(data.error)}`);
  }
  const raw = Buffer.from(data.result!.result).toString();
  return JSON.parse(raw) as T;
}

/**
 * Change-method call against the Delibera coordinator contract. Signs with the
 * same agent account that ShadeClient registered with the agent-registry contract.
 */
export async function deliberaCall<T>(
  methodName: string,
  args: Record<string, unknown>,
  opts: { gas?: bigint; deposit?: bigint } = {},
): Promise<T> {
  const account = await getAccount();
  const outcome = await account.functionCall({
    contractId: COORDINATOR_CONTRACT_ID,
    methodName,
    args,
    gas: opts.gas ?? GAS_200T,
    attachedDeposit: opts.deposit ?? 0n,
  });
  return outcome as unknown as T;
}
