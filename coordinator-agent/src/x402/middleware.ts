/**
 * x402 Stellar payment gateway middleware for Hono.
 *
 * Wraps @x402/hono's `paymentMiddlewareFromConfig` with our routes + Stellar scheme.
 * The middleware returns HTTP 402 with Stellar payment requirements on unpaid
 * requests to /x402/deliberate and /x402/verdict/:id, and forwards paid requests
 * to the downstream handlers.
 *
 * Scoped via `app.use('/x402/*', createX402Middleware())` in index.ts so it only
 * applies to the x402 routes and never touches the existing /api/coordinate/* flow.
 */

import { paymentMiddlewareFromConfig } from '@x402/hono';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactStellarScheme } from '@x402/stellar/exact/server';
import type { MiddlewareHandler } from 'hono';

import {
  STELLAR_SERVER_ADDRESS,
  STELLAR_NETWORK,
  X402_FACILITATOR_URL,
  OZ_API_KEY,
  X402_PRICES,
  isX402Configured,
} from './config';

/**
 * Build the x402 payment middleware configured for Stellar testnet via OZ Channels.
 *
 * If STELLAR_SERVER_ADDRESS is not set, returns a pass-through middleware so the
 * server still starts. The /x402/* routes will just 503 at the handler level.
 */
export function createX402Middleware(): MiddlewareHandler {
  if (!isX402Configured()) {
    // Pass-through: routes downstream still respond, but with a 503 degraded state.
    // Prevents server startup failure when running in LOCAL_MODE without Stellar.
    const passthrough: MiddlewareHandler = async (_c, next) => {
      await next();
    };
    return passthrough;
  }

  const facilitator = new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
    // OZ Channels mainnet requires an API key; testnet accepts unauthenticated
    // requests. We forward it as a Bearer token for all three endpoints if set.
    createAuthHeaders: OZ_API_KEY
      ? async () => {
          const headers = { Authorization: `Bearer ${OZ_API_KEY}` };
          return { verify: headers, settle: headers, supported: headers };
        }
      : undefined,
  });

  // Route keys use "METHOD /path" format per @x402/core RoutesConfig.
  // Prices are human-readable strings — the ExactStellarScheme parser converts
  // them to 7-decimal USDC base units (Stellar uses 7 decimals, not 6 like EVM).
  return paymentMiddlewareFromConfig(
    {
      'POST /x402/deliberate': {
        description: 'Submit a governance proposal for multi-agent deliberation.',
        accepts: {
          scheme: 'exact',
          price: X402_PRICES.deliberate,
          network: STELLAR_NETWORK,
          payTo: STELLAR_SERVER_ADDRESS,
        },
      },
      'GET /x402/verdict/:id': {
        description: 'Retrieve the signed verdict for a completed deliberation.',
        accepts: {
          scheme: 'exact',
          price: X402_PRICES.verdict,
          network: STELLAR_NETWORK,
          payTo: STELLAR_SERVER_ADDRESS,
        },
      },
    },
    facilitator,
    [{ network: STELLAR_NETWORK, server: new ExactStellarScheme() }],
  );
}
