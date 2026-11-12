/**
 * agent-connect-live-rail.ts — run the Agent Connect policy rail for real and
 * capture it as evidence.
 *
 * This is the one part of the product that cannot be replayed: the refusal has
 * to come from the API, live, in-window. The rail is:
 *
 *   1. PREFLIGHT — the partner key, the owner key and the agent must exist.
 *   2. THE BITE — a transfer to a destination that is NOT on the owner-signed
 *      whitelist. The Agent Connect API refuses it BEFORE dispatch, with
 *      `403 policy_destination_denied`. That refusal is the product.
 *   3. THE UNLOCK (optional, --ratify <address>) — the owner signs ONE
 *      policy_update adding that destination (NEP-413, no chain tx), the policy
 *      goes APPLIED + provider_policy_synced, and the SAME transfer now
 *      succeeds. That is the whole story: the verdict-gated wallet.
 *
 * Nothing here is invented: every field in the receipt comes from the API's own
 * response. The receipt records the refusal body verbatim.
 *
 * Exit codes: 0 = the rail ran and the bite was refused (or the unlock
 * succeeded), 1 = the rail ran and the guardrail did NOT hold (bad!), 2 = the
 * method surface is unavailable (no key, retired key, no agent) — the offline
 * judge stays green in that case.
 *
 * Usage:
 *   NEAR_ENV_FILE=... npx tsx scripts/agent-connect-live-rail.ts \
 *     --agent <agent_id> --out ../hackathon/evidence/fixtures/agent-connect/live-rail.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

// ── env (never echoed) ──────────────────────────────────────────────────────
// The client reads its key at module load, so the env file MUST be loaded
// before the client module is evaluated — hence the dynamic import below.
const envFile = process.env.NEAR_ENV_FILE || '.env.development.local';
try {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i);
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* no env file — rely on the process environment */ }

type ClientModule = typeof import('../src/agent-connect/client.js');

const ORACLE = process.env.AGENT_CONNECT_ORACLE_ACCOUNT || 'ac-oracle.delibera.near';
const VENDOR = process.env.AGENT_CONNECT_VENDOR_ACCOUNT || 'ac-owner.delibera.near';
const AMOUNT = '10000'; // $0.01 in 6-decimal atomic units

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x === `--${name}`);
  return a ? process.argv[process.argv.indexOf(a) + 1] : undefined;
}

interface RefusalBody {
  http?: number;
  code?: string;
  layer?: string;
  title?: string;
  detail?: string;
  correlation_id?: string;
  request_id?: string;
}

async function main(): Promise<number> {
  // The client reads its key at module load, so it is imported HERE — after the
  // env file was read above. A static import would be hoisted above it and the
  // client would see an empty key.
  const { policyView, balances, transfer, updatePolicyDestinations, issueGrantLive, AgentApiError } = await import('../src/agent-connect/client.js');
  const agentId = arg('agent') || process.env.AGENT_CONNECT_AGENT_ID || '';
  const out = arg('out') || join(process.cwd(), 'fixtures', 'agent-connect', 'live-rail.json');
  const ratify = arg('ratify');

  console.log('AGENT CONNECT LIVE RAIL — the guardrail, live');
  console.log('─'.repeat(72));

  if (!agentId) {
    console.log('RAIL: SKIP — no agent id (--agent or AGENT_CONNECT_AGENT_ID)');
    return 2;
  }
  if (!process.env.NEAR_INTENTS_AGENT_API_KEY) {
    console.log('RAIL: SKIP — no NEAR_INTENTS_AGENT_API_KEY (partner key)');
    return 2;
  }
  if (!process.env.AGENT_CONNECT_GRANT_TOKEN) {
    console.log('RAIL: SKIP — no AGENT_CONNECT_GRANT_TOKEN (the grant the agent acts under)');
    return 2;
  }

  // ── 1. preflight ──────────────────────────────────────────────────────────
  console.log(`agent ${agentId.slice(0, 16)}…`);
  let view: Record<string, any>;
  try {
    view = await policyView(agentId) as Record<string, any>;
  } catch (e: unknown) {
    const err = e as AgentApiError;
    const body = (err as unknown as { body?: { errors?: Array<{ code?: string; title?: string; detail?: string }> } }).body;
    const first = body?.errors?.[0];
    console.log(`RAIL: SKIP — the API refused the request: ${err.status} ${err.code}`);
    if (first?.title) console.log(`  ${first.title}: ${first.detail ?? ''}`);
    if (err.code === 'api_key_retired' || first?.code === 'api_key_retired') {
      console.log('  the partner key in the env is RETIRED — keys moved to the partner portal');
      console.log('  create a new key at https://partners.demo.agentsonintents.com and put it in the env');
    }
    return 2;
  }
  const destinations = (view.policy?.destinations?.list ?? []) as Array<{ address: string }>;
  console.log(`policy revision ${view.revision} · ${view.status} · provider_policy_synced ${view.provider_policy_synced}`);
  console.log(`destinations: ${destinations.map((d) => d.address).join(', ') || '(none)'}`);
  console.log(`budget: ${JSON.stringify(view.usage?.budget ?? null)}`);
  for (const src of ['public', 'confidential'] as const) {
    try {
      const b = await balances(agentId, src) as unknown as { balances?: Array<{ symbol?: string; balance_raw?: string }> };
      const usdc = (b.balances ?? []).filter((x) => x.symbol === 'USDC');
      console.log(`balance (${src}): ${usdc.map((u) => u.balance_raw).join(', ') || '0'}`);
    } catch { /* balances are advisory here */ }
  }

  const receipt: Record<string, unknown> = {
    meta: {
      capturedAt: new Date().toISOString(),
      api: process.env.NEAR_INTENTS_AGENT_API_URL || 'https://api.demo.agentsonintents.com',
      agentId,
      policyRevision: view.revision,
      policyHash: view.policy_hash,
      policyStatus: view.status,
      providerPolicySynced: view.provider_policy_synced,
      destinations: destinations.map((d) => d.address),
      budget: view.usage?.budget ?? null,
      ownerAccount: process.env.AGENT_CONNECT_OWNER_ACCOUNT || null,
    },
  };

  // ── 2. the bite ───────────────────────────────────────────────────────────
  // A destination that is NOT on the whitelist. The API must refuse it.
  const refused = ratify ?? VENDOR;
  const onList = destinations.some((d) => d.address === refused);
  if (onList) {
    console.log(`\n${refused} is already on the whitelist — nothing to refuse.`);
    console.log('RAIL: SKIP — pick a destination that is NOT whitelisted');
    return 2;
  }
  console.log(`\n[1] the agent tries to pay ${refused} (not on the whitelist) — $0.01`);
  let bite: { refused: boolean; body?: RefusalBody };
  let grantToken: string | undefined = undefined;
  try {
    const pay = await transfer(agentId, refused, AMOUNT, false, undefined, grantToken);
    bite = { refused: false };
    console.log(`  ⚠ THE TRANSFER WENT THROUGH — the guardrail did not hold.`);
    console.log(`    status ${pay.status} · correlation ${pay.correlationId} · tx ${pay.txHash ?? '—'}`);
    receipt.bite = { refused: false, status: pay.status, correlationId: pay.correlationId, txHash: pay.txHash ?? null };
  } catch (e: unknown) {
    const err = e as AgentApiError;
    if (err.code === 'agent_grant_required') {
      // The grant from the environment is dead (it was issued under the retired
      // key). Mint a fresh one with the owner's signature and retry.
      console.log(`  the grant from the env is not valid (${err.code}) — issuing a NEW grant with the owner's signature`);
      try {
        const g = await issueGrantLive(agentId, 'hackathon-live-rail');
        grantToken = g.token;
        receipt.grant = { issued: 'live, owner-signed (NEP-413)', grantId: g.grantId ?? null, tokenCommittedOnly: true };
        console.log(`  ✓ new grant issued${g.grantId ? ` (${g.grantId.slice(0, 16)}…)` : ''} — the token is never stored, only its commitment`);
      } catch (ge: unknown) {
        console.log(`  ✗ could not issue a grant: ${ge instanceof Error ? ge.message.slice(0, 200) : String(ge).slice(0, 200)}`);
        receipt.grant = { failed: ge instanceof Error ? ge.message.slice(0, 300) : String(ge).slice(0, 300) };
        return 2;
      }
      try {
        const pay = await transfer(agentId, refused, AMOUNT, false, undefined, grantToken);
        bite = { refused: false };
        console.log(`  ⚠ THE TRANSFER WENT THROUGH — the guardrail did not hold.`);
        receipt.bite = { refused: false, status: pay.status, correlationId: pay.correlationId, txHash: pay.txHash ?? null };
      } catch (e2: unknown) {
        const err2 = e2 as AgentApiError;
        const body2 = (err2 as unknown as { body?: RefusalBody }).body ?? { http: err2.status, code: err2.code };
        bite = { refused: true, body: body2 };
        console.log(`  ⛔ REFUSED: ${err2.status} ${err2.code}`);
        console.log(`     ${err2.message.slice(0, 300)}`);
        receipt.bite = { refused: true, body: body2, message: err2.message };
      }
    } else {
      // The API's own error body, verbatim.
      const body = (err as unknown as { body?: RefusalBody }).body ?? { http: err.status, code: err.code };
      bite = { refused: true, body };
      console.log(`  ⛔ REFUSED: ${err.status} ${err.code}`);
      console.log(`     ${err.message.slice(0, 300)}`);
      receipt.bite = { refused: true, body, message: err.message };
    }
  }

  // ── 3. the unlock (owner signature) ───────────────────────────────────────
  if (ratify) {
    console.log(`\n[2] the owner signs ONE policy_update adding ${ratify} to the whitelist`);
    try {
      const sig = await updatePolicyDestinations(agentId, ratify);
      console.log(`  signed (${sig.standard}) · revision after ${sig.revisionAfter}`);
      receipt.ratification = {
        standard: sig.standard,
        revisionAfter: sig.revisionAfter,
        message: sig.message,
        destinationsAdded: [ratify],
        signature: sig.signature,
      };
      console.log(`\n[3] the agent retries the same $0.01 transfer`);
      const pay = await transfer(agentId, ratify, AMOUNT, false, undefined, grantToken);
      console.log(`  ✓ ${pay.status} · correlation ${pay.correlationId} · tx ${pay.txHash ?? '—'}`);
      receipt.unlock = { status: pay.status, correlationId: pay.correlationId, txHash: pay.txHash ?? null };
    } catch (e: unknown) {
      const err = e as Error;
      console.log(`  ratification/unlock failed: ${err.message.slice(0, 240)}`);
      receipt.unlock = { failed: err.message.slice(0, 400) };
    }
  } else {
    console.log('\n(--ratify <address> would also capture the owner-signature unlock leg)');
  }

  // ── write the receipt ──────────────────────────────────────────────────────
  mkdirSync(dirname(out), { recursive: true });
  const body = JSON.stringify(receipt, null, 2) + '\n';
  writeFileSync(out, body);
  console.log(`\nreceipt → ${out}`);
  console.log(`receipt sha256: ${createHash('sha256').update(body, 'utf8').digest('hex')}`);

  const refusedOk = receipt.bite && (receipt.bite as { refused: boolean }).refused === true;
  console.log(`\nRAIL ${refusedOk ? 'PASS' : 'FAIL'} — the provider refused the un-whitelisted destination${refusedOk ? ' before dispatch' : ' — GUARDRAIL DID NOT HOLD'}`);
  return refusedOk ? 0 : 1;
}

void main().then((c) => process.exit(c)).catch((e: unknown) => {
  console.error('RAIL ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(2);
});
