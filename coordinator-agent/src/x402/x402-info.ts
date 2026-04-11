/**
 * GET /x402/info — free service discovery endpoint.
 *
 * Declares the Delibera deliberation oracle's capabilities, pricing, and
 * payment requirements so that x402 buyers (humans or AI agents) can
 * discover the service without paying. This is intentionally outside the
 * x402 middleware's route config so it returns 200 instead of 402.
 */

import { Hono } from 'hono';
import {
  STELLAR_NETWORK,
  STELLAR_SERVER_ADDRESS,
  X402_FACILITATOR_URL,
  X402_PRICES,
  isX402Configured,
} from './config';
import { listRecords } from './verdict-store';

const app = new Hono();

app.get('/', (c) => {
  if (!isX402Configured()) {
    return c.json(
      {
        status: 'disabled',
        reason:
          'STELLAR_SERVER_ADDRESS not configured — set it in .env.development.local to enable the x402 gateway.',
      },
      503,
    );
  }

  // Summary stats pulled from the verdict store — useful for buyers deciding
  // whether the service is healthy before spending USDC.
  const records = listRecords();
  const stats = {
    totalDeliberations: records.length,
    completed: records.filter((r) => r.status === 'completed').length,
    pending: records.filter((r) => r.status === 'pending').length,
    failed: records.filter((r) => r.status === 'failed').length,
  };

  return c.json({
    service: {
      name: 'Delibera Deliberation Oracle',
      description:
        'Multi-agent governance deliberation as a paid API. Pay in USDC on Stellar, trigger an on-chain NEAR vote by workers running in Phala TEEs, retrieve a signed verdict.',
      version: '1.0.0',
    },
    payment: {
      scheme: 'exact',
      network: STELLAR_NETWORK,
      payTo: STELLAR_SERVER_ADDRESS,
      facilitator: X402_FACILITATOR_URL,
      feesSponsored: true,
      asset: 'USDC (SEP-41 SAC)',
      note: 'OZ Channels sponsors Stellar network fees. Buyers need a funded USDC trustline but zero XLM.',
    },
    endpoints: [
      {
        method: 'GET',
        path: '/x402/info',
        price: 'free',
        description: 'Service discovery. Returns pricing, payment config, and health stats.',
      },
      {
        method: 'POST',
        path: '/x402/deliberate',
        price: X402_PRICES.deliberate,
        description:
          'Submit a governance proposal for multi-agent deliberation. Workers vote via NEAR AI inside Phala TEEs. Returns a deliberation id synchronously; poll /x402/verdict/:id for the result.',
        requestBody: {
          proposal: 'string — the proposal text to deliberate on (required)',
          context: 'object — optional structured context (links, constraints, voting_config)',
        },
      },
      {
        method: 'GET',
        path: '/x402/verdict/:id',
        price: X402_PRICES.verdict,
        description:
          'Retrieve the signed verdict for a completed deliberation. Returns 202 with status "pending" if workers are still voting, 200 with the full tally once complete.',
      },
    ],
    stats,
    timestamp: new Date().toISOString(),
  });
});

export default app;
