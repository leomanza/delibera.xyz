/**
 * x402 Stellar payment gateway configuration.
 *
 * Reads Stellar receiver address, facilitator URL, and prices from env.
 * Used by middleware.ts and x402-info.ts.
 *
 * Environment variables (append to .env.development.local):
 *   STELLAR_SERVER_ADDRESS   G... public key that receives USDC payments
 *   STELLAR_NETWORK          CAIP-2 network id (default: stellar:testnet)
 *   X402_FACILITATOR_URL     OZ Channels or Coinbase facilitator base URL
 *   OZ_API_KEY               Optional on testnet, required on mainnet
 *   X402_PRICE_DELIBERATE    Price string for /x402/deliberate (default: "$0.01")
 *   X402_PRICE_VERDICT       Price string for /x402/verdict/:id (default: "$0.002")
 */

export const STELLAR_SERVER_ADDRESS = process.env.STELLAR_SERVER_ADDRESS ?? '';

export const STELLAR_NETWORK = (process.env.STELLAR_NETWORK ?? 'stellar:testnet') as
  | 'stellar:testnet'
  | 'stellar:pubnet';

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? 'https://channels.openzeppelin.com/x402/testnet';

export const OZ_API_KEY = process.env.OZ_API_KEY ?? '';

export const X402_PRICES = {
  deliberate: process.env.X402_PRICE_DELIBERATE ?? '$0.01',
  verdict: process.env.X402_PRICE_VERDICT ?? '$0.002',
} as const;

/**
 * Returns true if all required x402/Stellar env vars are present.
 * Used by middleware.ts to short-circuit the middleware if the gateway is unconfigured
 * so the server still starts for /api/coordinate/* and health checks.
 */
export function isX402Configured(): boolean {
  return STELLAR_SERVER_ADDRESS.startsWith('G') && STELLAR_SERVER_ADDRESS.length === 56;
}

/**
 * Logs the current x402 gateway configuration (safe to log — no secrets).
 */
export function logX402Config(): void {
  if (!isX402Configured()) {
    console.warn('[x402] STELLAR_SERVER_ADDRESS not set — x402 gateway DISABLED');
    console.warn('[x402] Set STELLAR_SERVER_ADDRESS=G... in .env.development.local to enable');
    return;
  }
  console.log('[x402] Gateway ENABLED');
  console.log('[x402]   network:        ', STELLAR_NETWORK);
  console.log('[x402]   payTo:          ', STELLAR_SERVER_ADDRESS);
  console.log('[x402]   facilitator:    ', X402_FACILITATOR_URL);
  console.log('[x402]   oz_api_key:     ', OZ_API_KEY ? 'set' : '(none — testnet only)');
  console.log('[x402]   price.deliberate:', X402_PRICES.deliberate);
  console.log('[x402]   price.verdict:  ', X402_PRICES.verdict);
}
