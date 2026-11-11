/**
 * verify-settlement.ts — mainnet gate for the settlement claim.
 * View call (no gas, no keys) against the Delibera verdict contract.
 *
 * Rule: the README/demo may claim "verdict settled on mainnet" ONLY when this
 * prints LIVE for the mainnet contract. Until then every fixture stays
 * labeled testnet-capture and the judge sequence prints "omitted until
 * mainnet precedent" — never a false claim.
 *
 * Run: npm run verify:settlement
 */
const MAINNET_CONTRACT = 'coordinator.agents-coordinator.near';
const TESTNET_CONTRACT = 'coordinator.agents-coordinator.testnet';
const RPC_MAINNET = 'https://rpc.mainnet.fastnear.com';
const RPC_TESTNET = 'https://test.rpc.fastnear.com';

export interface SettlementStatus { testnetLive: boolean; mainnetLive: boolean; testnetId: number | null; mainnetId: number | null }

export async function probeContracts(quiet = false): Promise<SettlementStatus> {
  const testnet = await view('get_current_proposal_id', TESTNET_CONTRACT, RPC_TESTNET);
  const mainnet = await view('get_current_proposal_id', MAINNET_CONTRACT, RPC_MAINNET);
  const status: SettlementStatus = {
    testnetLive: typeof testnet === 'number',
    mainnetLive: typeof mainnet === 'number',
    testnetId: typeof testnet === 'number' ? testnet : null,
    mainnetId: typeof mainnet === 'number' ? mainnet : null,
  };
  if (!quiet) {
    console.log(`Settlement probe (view calls — free, read-only, no keys):\n`);
    console.log(`testnet ${TESTNET_CONTRACT}: ${status.testnetLive ? `LIVE — current proposal id: ${status.testnetId}` : 'NO-LIVE-RESULT'}`);
    console.log(`mainnet ${MAINNET_CONTRACT}: ${status.mainnetLive ? `LIVE — current proposal id: ${status.mainnetId}` : 'NO-LIVE-RESULT'}`);
  }
  return status;
}

// Trusted NEAR RPC JSON boundary: result is either a bare view value, an
// {error} object, or a {raw} string (unexpected shape) — probed, not parsed deeply.
export interface SettlementCandidate { error?: { message: string }; raw?: string }

async function view(method: string, contract: string, rpc: string, args: Record<string, unknown> = {}): Promise<number | string | SettlementCandidate> {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: contract,
          method_name: method,
          args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
        },
      }),
    });
    // NEAR RPC JSON boundary (trusted, read-only view call).
    const data: unknown = await res.json();
    const rpcError = (data as { error?: unknown }).error;
    if (rpcError) return { error: rpcError as { message: string } };
    const resultBytes = (data as { result?: { result?: number[] } }).result?.result;
    if (!resultBytes) return { error: { message: `unexpected response shape: ${JSON.stringify(data).slice(0, 120)}` } };
    const text = new TextDecoder().decode(new Uint8Array(resultBytes));
    try { return JSON.parse(text) as number; } catch { return { raw: text }; }
  } catch (e: unknown) {
    return { error: { message: e instanceof Error ? e.message : 'network error' } };
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].includes('verify-settlement');
if (invokedDirectly) {
  probeContracts()
    .then((s) => {
      console.log('');
      if (s.mainnetLive) {
        console.log('VERDICT: mainnet settlement contract is LIVE — claims may reference it (precedent receipt still needed for fixtures).');
        process.exit(0);
      }
      console.log('VERDICT: mainnet settlement NOT proven yet.');
      if (!s.testnetLive) {
        console.log('NOTE: the testnet contract itself did not answer as expected — validate the method surface before writing any claim.');
        process.exit(2);
      }
      console.log('Honesty rule holds: demo fixtures stay labeled testnet-capture until a gated live precedent settles on mainnet.');
      process.exit(0);
    })
    .catch((e) => { console.error(e); process.exit(1); });
}

