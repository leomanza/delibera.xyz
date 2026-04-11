/**
 * GET /x402/verdict/:id — paid verdict retrieval.
 *
 * The x402 middleware has already settled the buyer's Stellar payment before
 * this handler runs. We look up the in-memory verdict record by the id the
 * buyer received from /x402/deliberate and return one of:
 *
 *   - 404 if the id is unknown (typo or expired)
 *   - 202 if the deliberation is still pending (workers haven't finished)
 *   - 200 with the full tally if completed
 *   - 422 if the deliberation failed (refund logic is left to the operator)
 *
 * The response includes the original Stellar payment tx hash + the NEAR
 * proposal id so buyers have a cross-chain audit trail: payment on Stellar,
 * governance decision on NEAR.
 */

import { Hono } from 'hono';
import { getRecord } from './verdict-store';

const app = new Hono();

app.get('/:id', (c) => {
  const id = c.req.param('id');
  const record = getRecord(id);

  if (!record) {
    return c.json(
      {
        error: 'Deliberation not found',
        id,
        hint: 'The id may be invalid or from a previous server instance (verdict store is in-memory).',
      },
      404,
    );
  }

  const base = {
    deliberationId: record.id,
    status: record.status,
    proposal: record.proposal,
    stellarPaymentTx: record.stellarPaymentTx ?? null,
    nearProposalId: record.nearProposalId ?? null,
    createdAt: new Date(record.createdAt).toISOString(),
    completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
  };

  if (record.status === 'pending') {
    return c.json(
      {
        ...base,
        message: 'Workers are still deliberating. Retry in a few seconds.',
      },
      202,
    );
  }

  if (record.status === 'failed') {
    return c.json(
      {
        ...base,
        error: record.error ?? 'Deliberation failed with no error message',
      },
      422,
    );
  }

  // status === 'completed'
  return c.json({
    ...base,
    verdict: record.verdict,
  });
});

export default app;
