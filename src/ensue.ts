/**
 * ensue.ts — minimal Ensue Memory Network client (PORT of the Delibera
 * ensue-client pattern, shared/src/ensue-client.ts).
 *
 * Role in this repo: live-deliberation backbone only (day-2 gated run). Ensue
 * stores task definitions, per-juror status/result, and the public tally.
 * The judge's offline path reads captured fixtures instead — no Ensue needed.
 *
 * Endpoint: POST https://api.ensue-network.ai/ (JSON-RPC 2.0, tools/call).
 * Env: ENSUE_API_KEY — agent-registered keys are INACTIVE until a human claims
 * them (auth/agent-register flow); free-tier subscriptions expire after ~3h,
 * so the live loop polls rather than subscribes.
 */
const ENSUE_URL = (process.env.ENSUE_API_URL || 'https://api.ensue-network.ai').replace(/\/$/, '');
// Read at call time: run-live loads the secrets env file after imports.
const apiKey = () => process.env.ENSUE_API_KEY || '';

export const ensueConfigured = () => !!apiKey();

/** JSON-RPC result shape we actually consume (read path only). */
interface EnsueResource { content?: Array<{ text?: string }> }

// Ensue's JSON-RPC envelope is a trusted boundary: single hosted service,
// Bearer-authed, shape pinned in the ensue skill.
/* The hosted API streams JSON-RPC envelopes as SSE-ish lines: `data: {json}`.
 * Take the last data line; fall back to a plain JSON body for compat. */
interface RpcEnvelope { jsonrpc?: string; id?: number | string; result?: unknown; error?: { message?: string; code?: number | string } | unknown; text?: string }

export function parseEnsueResponse(text: string): RpcEnvelope {
  const lines = text.split('\n').filter((l) => l.startsWith('data:'));
  if (lines.length === 0) return JSON.parse(text) as RpcEnvelope;
  const last = lines[lines.length - 1].slice(5).trim();
  return JSON.parse(last) as RpcEnvelope;
}

// Ensue's JSON-RPC envelope is a trusted boundary: single hosted service,
// Bearer-authed, shape pinned in the ensue skill.
async function call(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new Error('ENSUE_API_KEY not set (live deliberation is gated; offline replay needs no Ensue)');
  const res = await fetch(`${ENSUE_URL}/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: args },
      id: Date.now(),
    }),
  });
  const data = parseEnsueResponse(await res.text());
  if (data.error) throw new Error(`Ensue error: ${JSON.stringify(data.error).slice(0, 200)}`);
  return data.result;
}

export const ensue = {
  /** Create keys — MUST precede update (create errors if the key exists). */
  create: (item: { key: string; value: string }) =>
    call('create_memory', { items: [{ key_name: item.key, description: item.key, value: item.value }] }),
  /** Set-or-update safe call: create once at task start, update afterwards. */
  set: async (key: string, value: string) => {
    try {
      return await ensue.create({ key, value });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already') || msg.includes('exist')) return ensue.update(key, value);
      throw e;
    }
  },
  update: (key: string, value: string) => call('update_memory', { key_name: key, value }),
  get: async (key: string) => {
    const r = (await call('get_memory', { key_names: [key] })) as EnsueResource;
    return r?.content?.[0]?.text;
  },
  list: (prefix: string) => call('list_keys', { prefix }),
};
