/**
 * client.ts — thin HTTP client for the NEAR Intents Agent API ("Agent Connect").
 *
 * Plain-HTTP path per the skills repo (NEAR-Intents-Agent-API/skills). Config
 * is env-only (demo keys rotate!):
 *   NEAR_INTENTS_AGENT_API_URL  default https://api.demo.agentsonintents.com
 *   NEAR_INTENTS_AGENT_API_KEY  naa_… partner key (backend-only, never in browser)
 *
 * MOCK MODE: when no API key is set, an in-memory policy engine simulates the
 * enforcement surface (destinations, per-tx limits, USD budget) so the demo's
 * guardrail-bites beats work offline. Mock refusals use the real error codes.
 */

const BASE_URL = (process.env.NEAR_INTENTS_AGENT_API_URL || 'https://api.demo.agentsonintents.com').replace(/\/$/, '');
const API_KEY = process.env.NEAR_INTENTS_AGENT_API_KEY || '';
export const USDT_NEAR = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'; // NEAR-native USDC (demo asset; on-chain policy revision 2)
export const OWNER_ACCOUNT = process.env.AGENT_CONNECT_OWNER_ACCOUNT || 'ac-owner.delibera.near';

/** REPLAY mode (AGENT_CONNECT_FIXTURES=1): never calls the API, never moves
 *  funds; the demo serves the real receipts harvested on 2026-10-19. */
export const replayMode = process.env.AGENT_CONNECT_FIXTURES === '1';
export const isMock = !API_KEY || replayMode;

export interface Policy {
  frozen: boolean;
  actions: ('swap' | 'transfer' | 'withdraw')[];
  confidential: boolean;
  owner_approval: boolean;
  assets: 'any' | string[];
  limits: { per_transaction?: Record<string, string> };
  max_actions_per_hour: number | null;
  destinations: { mode: 'only' | 'except' | 'any'; list: { action: string; address: string; confidential?: boolean }[] };
  budget: { daily_usd: string | null; weekly_usd: string | null; monthly_usd: string | null };
  timelock_ms: number;
}

export class AgentApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/* ── Real HTTP client ─────────────────────────────────────────────────── */

async function http(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const code = body?.errors?.[0]?.code || body?.code || 'unknown';
    throw new AgentApiError(res.status, code, `${res.status} ${code}: ${text.slice(0, 200)}`);
  }
  return body;
}

/* ── In-memory mock (offline demo) ────────────────────────────────────── */

interface MockAgent {
  agentId: string;
  policy: Policy;
  revision: number;
  balanceUsdCents: number;
  budgetSpentUsdCents: number;
}

const mockAgents = new Map<string, MockAgent>();
let mockSeq = 0;
const usdToCents = (usd: string) => Math.round(parseFloat(usd) * 100);
const atomic6ToCents = (atomic: string) => Math.round(Number(BigInt(atomic)) / 10_000); // 6 decimals

function mockPolicyEnforce(agent: MockAgent, recipient: string, amountAtomic: string) {
  const p = agent.policy;
  if (p.frozen) throw new AgentApiError(403, 'wallet_frozen', '403 wallet_frozen (mock)');
  if (!p.actions.includes('transfer')) throw new AgentApiError(403, 'policy_action_denied', '403 policy_action_denied (mock)');
  const allowed = p.destinations.mode === 'any' || p.destinations.list.some((d) => d.action === 'transfer' && d.address === recipient);
  if (p.destinations.mode === 'only' && !allowed) {
    throw new AgentApiError(403, 'policy_destination_denied', `403 policy_destination_denied: ${recipient} is not on the owner-signed whitelist (mock)`);
  }
  const perTx = p.limits.per_transaction?.['<usdc asset_id>'];
  if (perTx && BigInt(amountAtomic) > BigInt(perTx)) {
    throw new AgentApiError(403, 'policy_limit_exceeded', `403 policy_limit_exceeded: per-transaction cap (mock)`);
  }
  const monthly = p.budget.monthly_usd;
  if (monthly && agent.budgetSpentUsdCents + atomic6ToCents(amountAtomic) > usdToCents(monthly)) {
    throw new AgentApiError(403, 'budget_exceeded', `403 budget_exceeded: monthly USD budget spent (mock)`);
  }
}

/* ── Public API (real + mock share signatures) ────────────────────────── */

export async function ownerFullAccessKey(accountId = OWNER_ACCOUNT): Promise<string> {
  const res = await fetch('https://rpc.mainnet.fastnear.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'query',
      params: { request_type: 'view_access_key_list', finality: 'final', account_id: accountId },
    }),
  });
  const data: any = await res.json();
  const keys = data?.result?.keys || [];
  const full = keys.find((k: any) => k?.access_key?.permission === 'FullAccess');
  if (!full?.public_key) throw new Error(`no FullAccess key on ${accountId}`);
  return full.public_key;
}

export async function prepareAgentCreate(name: string, policy: Policy) {
  const publicKey = await ownerFullAccessKey();
  const gen = await http('/v1/generate-intent', {
    method: 'POST',
    body: JSON.stringify({
      type: 'agent_create',
      name,
      external_user_id: 'delibera-demo',
      owner: { type: 'near', account_id: OWNER_ACCOUNT, public_key: publicKey },
      policy,
    }),
  });
  return gen as {
    agent_id: string;
    correlation_id: string;
    type: string;
    intent: { standard: string; payload: unknown };
    preview: { summary?: string };
    signer: unknown;
  };
}

export async function submitSignedIntent(gen: { type: string; correlation_id: string; intent: unknown }, signedDelegate: string) {
  const intent = gen.intent as Record<string, unknown>;
  return http('/v1/submit-intent', {
    method: 'POST',
    body: JSON.stringify({
      type: gen.type,
      correlation_id: gen.correlation_id,
      signed_data: { ...intent, signed_delegate: signedDelegate },
    }),
  });
}

export async function createAgentWithPolicy(name: string, policy: Policy): Promise<{ agentId: string }> {
  if (isMock) {
    const agentId = `mock-agent-${++mockSeq}`;
    mockAgents.set(agentId, { agentId, policy, revision: 1, balanceUsdCents: 0, budgetSpentUsdCents: 0 });
    console.log(`[agent-connect:mock] agent_create "${name}" (owner signature simulated)`);
    return { agentId };
  }
  throw new Error('live agent_create needs an owner signature — use prepareAgentCreate');
}

export async function issueGrant(agentId: string): Promise<void> {
  if (isMock) {
    console.log('[agent-connect:mock] grant_issue (owner signature simulated, ngt_ stored)');
    return;
  }
  if (GRANT_TOKEN) return; // already issued for this agent (stored in env)
  throw new Error('AGENT_CONNECT_GRANT_TOKEN not set — issue a grant first');
}

export async function fund(agentId: string, usdCents: number): Promise<void> {
  if (isMock) {
    const a = mockAgents.get(agentId)!;
    a.balanceUsdCents += usdCents;
    console.log(`[agent-connect:mock] funded $${(usdCents / 100).toFixed(2)}`);
    return;
  }
  // live: funding is manual (user sends to the deposit address / agent NEAR address)
}

export interface RatifySig { standard?: string; message?: string; publicKey?: string; signature?: string; revisionAfter?: number; revision?: number; policy?: { revision?: number; hash?: string | null; destinationsAdded?: string[] } }
export async function updatePolicyDestinations(agentId: string, addAddress: string): Promise<RatifySig> {
  if (isMock) {
    const a = mockAgents.get(agentId)!;
    a.policy.destinations.list.push({ action: 'transfer', address: addAddress, confidential: false });
    a.revision += 1;
    console.log(`[agent-connect:mock] policy_update (owner signature simulated): + ${addAddress} whitelisted`);
    return { standard: 'simulated', message: `policy_update payload: + ${addAddress} whitelisted`, revisionAfter: a.revision, revision: a.revision, policy: { revision: a.revision, destinationsAdded: [addAddress] } };
  }
  const view = await http(`/v1/agents/${agentId}/policy`);
  if (view.status !== 'APPLIED') throw new Error(`policy not APPLIED: ${view.status}`);
  const policy = { ...view.policy };
  delete policy.revision;
  delete policy.usage;
  policy.destinations.list.push({ action: 'transfer', address: addAddress, confidential: false });
  const gen = await http('/v1/generate-intent', {
    method: 'POST',
    body: JSON.stringify({ type: 'policy_update', agent_id: agentId, policy, expected_revision: view.revision }),
  });
  const signedData = await ownerSignOwner(gen);
  const submitted = await http('/v1/submit-intent', {
    method: 'POST',
    body: JSON.stringify({ type: gen.type, correlation_id: gen.correlation_id, signed_data: signedData }),
  });
  const final = await waitStatus(submitted.correlation_id || gen.correlation_id);
  if (final?.status !== 'SUCCESS') throw new Error(`policy_update ${final?.status}: ${final?.failure_code || ''}`);
  // wait until the new policy is actually enforced; return evidence for the UI
  let revisionAfter: number | undefined;
  for (let i = 0; i < 20; i++) {
    const p = await http(`/v1/agents/${agentId}/policy`);
    if (p.status === 'APPLIED' && p.provider_policy_synced === true) {
      return {
        standard: signedData.standard,
        message: signedData.payload?.message,
        publicKey: signedData.public_key?.split(',')?.[0] || undefined,
        signature: signedData.signature,
        revisionAfter: p.revision,
        revision: p.revision,
        policy: { revision: p.revision, hash: p.policy_hash, destinationsAdded: [addAddress] },
      } as RatifySig;
    }
    revisionAfter = p.revision;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('policy_update did not sync in time');
}

export interface TransferResult {
  status: string;
  correlationId: string;
  txHash?: string;
}

/* ── Live (real API) helpers ──────────────────────────────────────────── */

export const GRANT_TOKEN = process.env.AGENT_CONNECT_GRANT_TOKEN || '';

export async function network(): Promise<any> {
  return http('/v1/network');
}

export async function policyView(agentId: string): Promise<any> {
  return http(`/v1/agents/${agentId}/policy`);
}

export async function balances(agentId: string, source: 'public' | 'confidential'): Promise<any[]> {
  const res = await http(`/v1/agents/${agentId}/balances?source=${source}`, {
    headers: { 'X-Grant-Token': GRANT_TOKEN },
  });
  return res?.balances || [];
}

export async function shield(agentId: string, asset: string, amountAtomic: string, idempotencyKey?: string) {
  return http(`/v1/agents/${agentId}/shield`, {
    method: 'POST',
    headers: { 'X-Grant-Token': GRANT_TOKEN, 'Idempotency-Key': idempotencyKey || `sh:${agentId}:${Date.now()}` },
    body: JSON.stringify({ asset, amount: amountAtomic }),
  });
}

/** Server-side owner signature — the demo owner accounts are ours, so the server signs
 *  on their behalf. Returns the complete `signed_data` for /v1/submit-intent. */
export async function ownerSignOwner(gen: any): Promise<any> {
  const { execFileSync } = await import('node:child_process');
  const { KeyPair } = await import('@near-js/crypto');

  const standard = gen.intent.standard as 'nep413' | 'nep366';
  const raw = execFileSync('security', ['find-generic-password', '-s', `near-mainnet-${OWNER_ACCOUNT}`, '-w'], { encoding: 'utf8' }).trim();
  const secret = raw.startsWith('{') ? JSON.parse(raw).private_key : raw;
  const keyPair = KeyPair.fromString(secret);
  const publicKey = keyPair.getPublicKey().toString();

  if (standard === 'nep413') {
    const p = gen.intent.payload as { message: string; nonce: string; recipient: string };
    const msgb = Buffer.from(p.message, 'utf8');
    const recb = Buffer.from(p.recipient, 'utf8');
    const parts: Buffer[] = [];
    const tag = Buffer.alloc(4); tag.writeUInt32LE(2147484061);
    const msgLen = Buffer.alloc(4); msgLen.writeUInt32LE(msgb.length);
    const nonce = Buffer.from(p.nonce, 'base64');
    const recLen = Buffer.alloc(4); recLen.writeUInt32LE(recb.length);
    parts.push(tag, msgLen, msgb, nonce, recLen, recb, Buffer.from([0]));
    const serialized = Buffer.concat(parts);
    const { createHash } = await import('node:crypto');
    const digest = createHash('sha256').update(serialized).digest();
    const signed = keyPair.sign(digest);
    const signature = Buffer.from(signed.signature).toString('base64');
    return { standard, payload: p, public_key: publicKey, signature };
  }

  const { createHash } = await import('node:crypto');
  const { JsonRpcProvider } = await import('@near-js/providers');
  const { Signature, actionCreators, encodeDelegateAction, encodeSignedDelegate } = await import('@near-js/transactions');
  const provider = new JsonRpcProvider({ url: 'https://rpc.mainnet.fastnear.com' });
  const pubKeyObj = keyPair.getPublicKey();
  const access = await provider.viewAccessKey(OWNER_ACCOUNT, pubKeyObj, { finality: 'final' });

  const delegateAction = {
    senderId: OWNER_ACCOUNT,
    receiverId: gen.intent.payload.receiverId,
    publicKey: pubKeyObj,
    nonce: BigInt(access.nonce) + 1n,
    maxBlockHeight: BigInt(access.block_height) + 120n,
    actions: gen.intent.payload.actions.map(({ params }: any) =>
      actionCreators.functionCall(params.methodName, Buffer.from(JSON.stringify(params.args)), BigInt(params.gas), BigInt(params.deposit)),
    ),
  };
  const digest = createHash('sha256').update(encodeDelegateAction(delegateAction)).digest();
  const signed = keyPair.sign(digest);
  const signedDelegate = Buffer.from(
    encodeSignedDelegate({ delegateAction, signature: new Signature({ keyType: 0, data: signed.signature }) }),
  ).toString('base64');
  return { standard, payload: gen.intent.payload, signed_delegate: signedDelegate };
}

export async function waitStatus(correlationId: string, tries = 20): Promise<any> {
  let last: any = null;
  for (let i = 0; i < tries; i++) {
    last = await http(`/v1/status?correlation_id=${correlationId}&wait_ms=5000`);
    if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(last?.status)) return last;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

export async function transfer(agentId: string, recipient: string, amountAtomic: string, confidential: boolean, idempotencyKey?: string): Promise<TransferResult> {
  if (isMock) {
    const a = mockAgents.get(agentId)!;
    mockPolicyEnforce(a, recipient, amountAtomic); // throws with real error codes
    a.balanceUsdCents -= atomic6ToCents(amountAtomic);
    a.budgetSpentUsdCents += atomic6ToCents(amountAtomic);
    return { status: 'SUCCESS', correlationId: `op_mock_${Date.now()}`, txHash: `mocktx${Date.now().toString(36)}` };
  }
  const res = await http(`/v1/agents/${agentId}/transfer`, {
    method: 'POST',
    headers: { 'X-Grant-Token': GRANT_TOKEN, 'Idempotency-Key': idempotencyKey || `tr:${agentId}:${Date.now()}` },
    body: JSON.stringify({ asset: USDT_NEAR, amount: amountAtomic, recipient, confidential }),
  });
  return { status: res.status, correlationId: res.correlation_id, txHash: res.details?.tx_hash };
}
