/**
 * /api/x402-demo — server-side x402 buyer (Pattern C).
 *
 * Runs the exact same flow as x402-client/client.ts, but inside a Next.js
 * route handler so the browser doesn't need a Stellar wallet, doesn't need
 * @x402/* in its bundle, and judges can hit "Run" without installing
 * anything. The page (frontend/src/app/x402-demo/page.tsx) calls this and
 * renders the SSE updates as a live stepper.
 *
 * Wire format: text/event-stream. One event type, `update`, with payloads:
 *
 *   { phase: "discovering" }                   ← /x402/info fetch in flight
 *   { phase: "discovered", endpoints: [...] }  ← /x402/info responded
 *   { phase: "paying" }                        ← x402 negotiation in flight
 *   { phase: "deliberating",  elapsedMs: N,
 *     stellarTx: "..." }                       ← payment settled, workers
 *                                                  voting (heartbeat every 5s)
 *   { phase: "verdict", verdict: {...},
 *     deliberationId: "...", stellarTx: "...",
 *     nearProposalId: N }                      ← terminal: success
 *   { phase: "failed", error: "..." }          ← terminal: failure
 *
 * The buyer secret lives in STELLAR_DEMO_BUYER_KEY (set up via
 * `pnpm setup-demo-wallet`). Rate-limited in-memory: 5 runs per IP per hour,
 * 100 runs per day total. In-memory state is per-instance — fine for a
 * hackathon single-instance deploy; swap for Upstash if you scale out.
 *
 * ── Architecture note: why streaming + Fluid Compute, not Vercel Workflow ──
 * The coordinator's /x402/deliberate endpoint holds its connection open for
 * up to 90s waiting for workers to vote (the Promise.race window in
 * coordinator-agent/src/x402/x402-deliberate.ts). That ~90s is the worst-case
 * duration of this whole route — well under the 300s default Fluid Compute
 * timeout, with no polling involved. We're not waiting between fetches; it's
 * a single long fetch the user wants to *watch* unfold. This is exactly the
 * "Under 5 min → Fluid Compute with streaming" pattern in Vercel's docs;
 * Workflow DevKit is reserved for hours-to-days durable processes, and would
 * be wildly overkill here. The setInterval + setTimeout below are UI-only
 * progress hints, not state polling — they exist purely to give the SSE
 * stream periodic content during the single upstream fetch.
 */

import { createEd25519Signer } from '@x402/stellar';
import { ExactStellarScheme } from '@x402/stellar/exact/client';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';

/* ─── Config ───────────────────────────────────────────────────────────── */

const STELLAR_DEMO_BUYER_KEY =
  process.env.STELLAR_DEMO_BUYER_KEY ?? process.env.STELLAR_PRIVATE_KEY ?? '';
const DELIBERA_SERVER_URL = (
  process.env.DELIBERA_SERVER_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');
const STELLAR_NETWORK = 'stellar:testnet' as const;

// Heuristic: after this much wall-clock time inside the deliberate POST, we
// assume x402 negotiation is done and the workers are actually deliberating.
// The real payment settles in ~1–2s; this gives the UI a clean phase
// transition without instrumenting wrapFetchWithPayment internals.
const PHASE_DELIBERATING_AFTER_MS = 3_000;

// Heartbeat cadence while waiting on the deliberate response — keeps the SSE
// connection warm through proxies and gives the UI an elapsed counter.
const HEARTBEAT_INTERVAL_MS = 5_000;

/* ─── Rate limiting (in-memory, single-instance) ───────────────────────── */

const RATE_LIMIT_PER_IP_PER_HOUR = 5;
const RATE_LIMIT_TOTAL_PER_DAY = 100;

const ipHits = new Map<string, number[]>();
const allHits: number[] = [];

function checkRateLimit(ip: string):
  | { ok: true }
  | { ok: false; status: number; reason: string } {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // Prune stale per-IP and global windows.
  for (const [key, hits] of ipHits) {
    const fresh = hits.filter((t) => t > hourAgo);
    if (fresh.length === 0) ipHits.delete(key);
    else ipHits.set(key, fresh);
  }
  while (allHits.length > 0 && allHits[0] < dayAgo) allHits.shift();

  const myHits = ipHits.get(ip) ?? [];
  if (myHits.length >= RATE_LIMIT_PER_IP_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      reason: `IP rate limit reached (${RATE_LIMIT_PER_IP_PER_HOUR} runs per hour). Try again later.`,
    };
  }
  if (allHits.length >= RATE_LIMIT_TOTAL_PER_DAY) {
    return {
      ok: false,
      status: 429,
      reason: `Daily demo cap reached (${RATE_LIMIT_TOTAL_PER_DAY} runs per day). Try again tomorrow.`,
    };
  }

  // Record AFTER passing both checks so failed requests don't burn quota.
  myHits.push(now);
  ipHits.set(ip, myHits);
  allHits.push(now);
  return { ok: true };
}

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/* ─── X-PAYMENT-RESPONSE header decoding (Stellar tx hash) ─────────────── */

function extractStellarTxFromResponse(res: Response): string | undefined {
  const header = res.headers.get('X-PAYMENT-RESPONSE');
  if (!header) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    return decoded.transaction ?? decoded.txHash ?? decoded.networkTxId ?? undefined;
  } catch {
    return undefined;
  }
}

/* ─── Request body validation ──────────────────────────────────────────── */

interface DemoRequestBody {
  proposal: string;
  context?: Record<string, unknown>;
  // Populated in the POST handler from req.signal — not part of the wire
  // format, just a convenient way to pass the abort signal into runBuyerFlow.
  abortSignal?: AbortSignal;
}

function validateBody(body: unknown): DemoRequestBody | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const proposal = typeof b.proposal === 'string' ? b.proposal.trim() : '';
  if (!proposal) return { error: 'proposal is required (non-empty string)' };
  if (proposal.length > 8000) return { error: 'proposal too long (max 8000 chars)' };

  const context =
    typeof b.context === 'object' && b.context !== null
      ? (b.context as Record<string, unknown>)
      : undefined;
  return { proposal, context };
}

/* ─── SSE helpers ──────────────────────────────────────────────────────── */

interface UpdateEvent {
  phase:
    | 'discovering'
    | 'discovered'
    | 'paying'
    | 'deliberating'
    | 'verdict'
    | 'failed';
  [k: string]: unknown;
}

function makeEmitter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
  let closed = false;
  return {
    send(event: UpdateEvent): void {
      if (closed) return;
      const payload = `event: update\ndata: ${JSON.stringify(event)}\n\n`;
      try {
        controller.enqueue(encoder.encode(payload));
      } catch {
        closed = true;
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
    isClosed(): boolean {
      return closed;
    },
  };
}

/* ─── The actual buyer flow (mirrors client.ts) ────────────────────────── */

async function runBuyerFlow(
  emit: ReturnType<typeof makeEmitter>,
  body: DemoRequestBody,
): Promise<void> {
  // ── Pre-flight: env check ────────────────────────────────────────────
  if (!STELLAR_DEMO_BUYER_KEY) {
    emit.send({
      phase: 'failed',
      error:
        'STELLAR_DEMO_BUYER_KEY is not set on the server. Run `pnpm --filter frontend setup-demo-wallet` to provision one.',
    });
    return;
  }
  if (!STELLAR_DEMO_BUYER_KEY.startsWith('S') || STELLAR_DEMO_BUYER_KEY.length !== 56) {
    emit.send({
      phase: 'failed',
      error: 'STELLAR_DEMO_BUYER_KEY is malformed (expected a 56-char Stellar secret).',
    });
    return;
  }

  // ── Build x402 fetch wrapper (same as client.ts) ─────────────────────
  const signer = createEd25519Signer(STELLAR_DEMO_BUYER_KEY, STELLAR_NETWORK);
  const scheme = new ExactStellarScheme(signer);
  const client = new x402Client().register(STELLAR_NETWORK, scheme);
  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  // ── Phase 1: free discovery ──────────────────────────────────────────
  emit.send({ phase: 'discovering' });
  const infoRes = await fetch(`${DELIBERA_SERVER_URL}/x402/info`).catch((err) => {
    throw new Error(`Coordinator unreachable at ${DELIBERA_SERVER_URL}: ${err.message ?? err}`);
  });
  if (!infoRes.ok) {
    throw new Error(`/x402/info returned ${infoRes.status}`);
  }
  const info = (await infoRes.json()) as {
    service: { name: string; description: string; version: string };
    payment: { network: string; payTo: string };
    endpoints: Array<{ method: string; path: string; price: string }>;
  };
  emit.send({
    phase: 'discovered',
    serviceName: info.service.name,
    serviceVersion: info.service.version,
    payTo: info.payment.payTo,
    network: info.payment.network,
    buyerAddress: signer.address,
    endpoints: info.endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      price: e.price,
    })),
  });

  // ── Phase 2 + 3: paid deliberation (single fetch, multi-phase UI) ────
  emit.send({ phase: 'paying' });

  const t0 = Date.now();

  // Heuristic phase shift: after PHASE_DELIBERATING_AFTER_MS we assume the
  // x402 negotiation is done and the workers are now deliberating. We also
  // emit a heartbeat every HEARTBEAT_INTERVAL_MS so the UI can show an
  // elapsed counter and proxies don't drop the connection.
  let deliberatingStarted = false;

  const phaseShift: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (emit.isClosed()) return;
    deliberatingStarted = true;
    emit.send({
      phase: 'deliberating',
      elapsedMs: Date.now() - t0,
      message: 'Payment settled. AI workers deliberating...',
    });
  }, PHASE_DELIBERATING_AFTER_MS);

  const heartbeat: ReturnType<typeof setInterval> = setInterval(() => {
    if (emit.isClosed()) return;
    if (!deliberatingStarted) return;
    emit.send({
      phase: 'deliberating',
      elapsedMs: Date.now() - t0,
      heartbeat: true,
    });
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = (): void => {
    if (phaseShift) clearTimeout(phaseShift);
    if (heartbeat) clearInterval(heartbeat);
  };

  let deliberateRes: Response;
  try {
    deliberateRes = await fetchWithPay(`${DELIBERA_SERVER_URL}/x402/deliberate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal: body.proposal,
        context: body.context ?? {},
      }),
      // Honor client disconnect: if the user closes the tab, cancel the
      // upstream fetch so we don't keep the coordinator's deliberate handler
      // pinned for 90s with nobody listening. The signal is plumbed in via
      // runBuyerFlow's caller (POST handler, from req.signal).
      signal: body.abortSignal,
    });
  } catch (err) {
    cleanup();
    throw new Error(
      `x402 payment/deliberate failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  cleanup();

  const stellarTx = extractStellarTxFromResponse(deliberateRes);

  // Coordinator returns 200 (verdict inline), 422 (failed inline), 202
  // (still pending — fallback path), or other (real error).
  if (
    !deliberateRes.ok &&
    deliberateRes.status !== 202 &&
    deliberateRes.status !== 422
  ) {
    const errText = await deliberateRes.text().catch(() => '');
    throw new Error(`/x402/deliberate returned ${deliberateRes.status}: ${errText.slice(0, 300)}`);
  }

  type VerdictResponse = {
    deliberationId: string;
    status: string;
    proposal: string;
    stellarPaymentTx: string | null;
    nearProposalId: number | null;
    verdict?: {
      decision: string;
      approved: number;
      rejected: number;
      workerCount: number;
      aggregatedValue: number;
      workers: Array<{ workerId: string; output: { vote?: string; reasoning?: string } }>;
    };
    error?: string;
  };

  const data = (await deliberateRes.json()) as VerdictResponse;

  // Inline success.
  if (deliberateRes.status === 200 && data.verdict) {
    emit.send({
      phase: 'verdict',
      verdict: data.verdict,
      deliberationId: data.deliberationId,
      stellarTx: stellarTx ?? data.stellarPaymentTx ?? null,
      nearProposalId: data.nearProposalId,
      elapsedMs: Date.now() - t0,
    });
    return;
  }

  // Inline failure.
  if (deliberateRes.status === 422) {
    emit.send({
      phase: 'failed',
      error: data.error ?? 'Deliberation failed inline (no reason given)',
      deliberationId: data.deliberationId,
      stellarTx: stellarTx ?? data.stellarPaymentTx ?? null,
      elapsedMs: Date.now() - t0,
    });
    return;
  }

  // 202 fallback — coordinator did not return inline. Surface this honestly:
  // the demo wallet still paid, but the verdict will land later via the
  // verdict-store. We don't poll here (the SSE channel is already long
  // enough); the page can show a "still running, check back" state.
  emit.send({
    phase: 'failed',
    error: `Coordinator did not return a verdict within its 90s window. Deliberation ${data.deliberationId} is still running — check it via /x402/verdict/${data.deliberationId}.`,
    deliberationId: data.deliberationId,
    stellarTx: stellarTx ?? data.stellarPaymentTx ?? null,
    elapsedMs: Date.now() - t0,
  });
}

/* ─── POST handler ─────────────────────────────────────────────────────── */

export async function POST(req: Request): Promise<Response> {
  // 1. Body validation (cheap, do before rate limit so malformed bodies
  //    don't burn the IP's quota).
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be valid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const validated = validateBody(parsedBody);
  if ('error' in validated) {
    return new Response(JSON.stringify(validated), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Rate limit by IP + global daily cap.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: rl.reason }), {
      status: rl.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. SSE stream — run the buyer flow inside the stream's start callback so
  //    cleanup happens automatically when the stream closes. Plumb req.signal
  //    through so client disconnects propagate to the upstream fetchWithPay
  //    call (we don't want to keep the coordinator's 90s window pinned if
  //    nobody is listening anymore).
  const flowInput: DemoRequestBody = { ...validated, abortSignal: req.signal };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = makeEmitter(controller, encoder);

      try {
        await runBuyerFlow(emit, flowInput);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[x402-demo] buyer flow failed:', err);
        emit.send({ phase: 'failed', error: message });
      } finally {
        emit.close();
      }
    },
    cancel() {
      // Client disconnected (closed tab, navigated away). The runBuyerFlow
      // promise is already racing on req.signal, so this is mostly belt-and-
      // suspenders — the AbortSignal does the real work upstream.
      console.log('[x402-demo] client disconnected, cancelling stream');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable buffering on Vercel/nginx so events flush immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}

// Force Node runtime — @x402/stellar relies on Node-only modules
// (Buffer, crypto, etc.) that aren't available in the edge runtime.
export const runtime = 'nodejs';

// Disable static optimization — this route is purely dynamic.
export const dynamic = 'force-dynamic';

// Set explicit ceiling: coordinator's await window is 90s, x402 negotiation
// adds ~2s, /x402/info discovery adds <1s. 120s gives a comfortable buffer
// while staying well under Vercel's 300s default Fluid Compute timeout.
// Pro/Enterprise can extend to 800s if the coordinator window is widened.
export const maxDuration = 120;
