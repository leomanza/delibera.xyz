/**
 * POST /x402/deliberate — paid deliberation trigger (await-to-completion).
 *
 * Flow:
 *   1. The x402 middleware (mounted in index.ts) has already verified +
 *      settled the buyer's Stellar USDC payment by the time this handler
 *      runs. The X-PAYMENT-RESPONSE header (set by the middleware) carries
 *      the Stellar tx hash; we read it off the context for the audit trail.
 *   2. Parse the buyer-supplied proposal + optional structured context.
 *   3. Kick off the existing coordination loop via triggerLocalCoordination()
 *      and hold the HTTP connection open for up to X402_DELIBERATE_AWAIT_MS
 *      (default 90s). The coordinator already polls workers internally and
 *      returns the tally once they all vote — we just wait for it.
 *   4. If the tally lands within the window, return 200 with the full verdict
 *      in a single response. Cost to the buyer: $0.01, zero polling.
 *   5. If the window expires first, return 202 with the deliberation id. The
 *      background task keeps running and updates the verdict store, so the
 *      buyer can recover via GET /x402/verdict/:id ($0.002/poll). This is the
 *      crash-recovery fallback — e.g., if a proxy/CDN cuts the connection.
 *
 * This route is purely additive: it reuses the existing governance loop
 * without touching /api/coordinate/* or changing how workers are triggered.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { triggerLocalCoordination } from '../monitor/memory-monitor';
import { createRecord, updateRecord, type VerdictRecord } from './verdict-store';

const app = new Hono();

/**
 * Max time the POST handler will wait for the coordination loop to finish
 * before falling back to the async 202 path. Defaults to 115s — stays under
 * the frontend x402-demo route's 120s maxDuration cap while leaving room for
 * 3-worker deliberations that include AI inference (~25s) plus the serial
 * NEAR tx chain (start_coordination → record_submissions → coordinator_resume
 * → finalize) plus Storacha/Lit backup, which together can push past 90s
 * especially when any tx retries on a nonce conflict.
 */
const AWAIT_TIMEOUT_MS = Number(process.env.X402_DELIBERATE_AWAIT_MS ?? 115_000);

/**
 * Pull the Stellar settlement tx hash (if any) off the x402 response header.
 * The x402 middleware writes X-PAYMENT-RESPONSE after /settle succeeds; the
 * value is a base64-encoded JSON blob containing the network tx id. We decode
 * defensively — if the header shape changes we log a warning but keep going,
 * because the deliberation should still run for a paid buyer.
 */
function extractStellarTxHash(c: Context): string | undefined {
  const header = c.res.headers.get('X-PAYMENT-RESPONSE');
  if (!header) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    // The field name varies across x402 versions — try the common ones.
    return decoded.transaction ?? decoded.txHash ?? decoded.networkTxId ?? undefined;
  } catch (err) {
    console.warn('[x402/deliberate] Could not parse X-PAYMENT-RESPONSE header:', err);
    return undefined;
  }
}

/**
 * Serialize a verdict record into the JSON shape the buyer sees. Shared with
 * GET /x402/verdict/:id so the two endpoints return identical schemas — the
 * client can use the same parser either way.
 */
function serializeRecord(record: VerdictRecord) {
  return {
    deliberationId: record.id,
    status: record.status,
    proposal: record.proposal,
    stellarPaymentTx: record.stellarPaymentTx ?? null,
    nearProposalId: record.nearProposalId ?? null,
    createdAt: new Date(record.createdAt).toISOString(),
    completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
    verdict: record.verdict,
    error: record.error,
  };
}

interface DeliberateRequestBody {
  proposal: string;
  context?: Record<string, unknown>;
}

app.post('/', async (c) => {
  let body: DeliberateRequestBody;
  try {
    body = await c.req.json<DeliberateRequestBody>();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  const proposal = (body.proposal ?? '').trim();
  if (!proposal) {
    return c.json(
      { error: 'proposal is required (non-empty string)' },
      400,
    );
  }
  if (proposal.length > 8000) {
    return c.json(
      { error: 'proposal too long (max 8000 characters)' },
      400,
    );
  }

  const stellarPaymentTx = extractStellarTxHash(c);
  const record = createRecord({
    proposal,
    context: body.context,
    stellarPaymentTx,
  });

  // Build the taskConfig JSON the existing coordination loop expects.
  // triggerLocalCoordination parses it as a JSON string (see memory-monitor
  // line 184). Use type='vote' — the worker's performWork dispatcher routes
  // that through the real AI voting flow (fetch manifesto → call NEAR AI with
  // dao_vote tool → return {vote, reasoning}). Any other type falls through to
  // the random-number default and produces 0ms "work" with no vote, which
  // breaks aggregation. We forward x402DeliberationId and voting_config at the
  // top level / parameters so coordinator + audit trail can correlate.
  const taskConfig = {
    type: 'vote',
    x402DeliberationId: record.id,
    proposal,
    parameters: {
      proposal,
      context: body.context ?? {},
      voting_config: (body.context as { voting_config?: unknown } | undefined)?.voting_config,
    },
  };
  const taskConfigStr = JSON.stringify(taskConfig);

  console.log(
    `[x402/deliberate] New paid deliberation: id=${record.id} tx=${stellarPaymentTx ?? 'n/a'} proposal="${proposal.slice(0, 80)}${proposal.length > 80 ? '…' : ''}"`,
  );

  // Kick off the coordination loop. We keep a handle to the promise so we can
  // race it against a timeout AND so the background execution continues even
  // if the await window expires — the verdict store still gets updated,
  // enabling the GET /x402/verdict/:id recovery path for dropped connections.
  const runPromise = runDeliberation(record.id, taskConfigStr);
  // Defensive: ensure an unhandled rejection from the background path never
  // crashes the process. runDeliberation already catches internally, but
  // attach a no-op handler so there's no lingering rejection if we don't
  // await runPromise to completion.
  runPromise.catch(() => undefined);

  // Race the coordination promise against the await-window timer. Whoever
  // resolves first wins; the other keeps running / is GC'd.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(null), AWAIT_TIMEOUT_MS);
  });

  const finished = await Promise.race([runPromise, timeoutPromise]);
  if (timeoutHandle) clearTimeout(timeoutHandle);

  // Fast path: coordination finished inside the window.
  if (finished && finished.status === 'completed') {
    console.log(
      `[x402/deliberate] ${record.id} returned inline (${finished.verdict?.decision ?? 'n/a'})`,
    );
    return c.json(serializeRecord(finished), 200);
  }
  if (finished && finished.status === 'failed') {
    console.warn(`[x402/deliberate] ${record.id} failed inline: ${finished.error ?? 'unknown'}`);
    return c.json(serializeRecord(finished), 422);
  }

  // Fallback path: await window expired. The background task continues.
  // The buyer gets the deliberation id and can recover via /x402/verdict/:id.
  console.log(
    `[x402/deliberate] ${record.id} still running after ${AWAIT_TIMEOUT_MS}ms — returning 202, client may poll /x402/verdict/${record.id}`,
  );
  return c.json(
    {
      deliberationId: record.id,
      status: 'pending',
      statusUrl: `/x402/verdict/${record.id}`,
      verdictUrl: `/x402/verdict/${record.id}`,
      stellarPaymentTx: record.stellarPaymentTx ?? null,
      createdAt: new Date(record.createdAt).toISOString(),
      message: `Coordination exceeded the ${Math.round(AWAIT_TIMEOUT_MS / 1000)}s await window. Poll GET /x402/verdict/${record.id} to retrieve the result.`,
    },
    202,
  );
});

/**
 * Run the coordination loop for this deliberation and merge the result back
 * into the verdict store. Never throws — a failed coordination marks the
 * record as 'failed' so both the inline race and the fallback /verdict poll
 * can distinguish pending from broken deliberations.
 *
 * Returns the final VerdictRecord (or undefined if the id was evicted from
 * the store, which shouldn't happen in practice). Callers race this against
 * a timer; the promise keeps executing even if the race loses.
 */
async function runDeliberation(
  id: string,
  taskConfigStr: string,
): Promise<VerdictRecord | undefined> {
  try {
    const tally = await triggerLocalCoordination(taskConfigStr);
    if (tally === null) {
      const updated = updateRecord(id, {
        status: 'failed',
        error:
          'Coordination returned null (timeout, insufficient workers, or contract resume failed — check coordinator logs)',
      });
      console.warn(`[x402/deliberate] Deliberation ${id} failed: null tally`);
      return updated;
    }
    const updated = updateRecord(id, {
      status: 'completed',
      verdict: tally,
      nearProposalId: tally.proposalId,
    });
    console.log(
      `[x402/deliberate] Deliberation ${id} completed: decision=${tally.decision} approved=${tally.approved} rejected=${tally.rejected}`,
    );
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const updated = updateRecord(id, { status: 'failed', error: message });
    console.error(`[x402/deliberate] Deliberation ${id} threw:`, err);
    return updated;
  }
}

export default app;
