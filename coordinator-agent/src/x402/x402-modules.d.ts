/**
 * Ambient module declarations for @x402 packages.
 *
 * The @x402/* packages ship both CJS and ESM builds via conditional
 * `exports` maps in package.json. Classic Node module resolution
 * (moduleResolution: "node") cannot follow those subpath exports, and
 * @x402/hono's root `types` field additionally points to a non-existent
 * file. These stubs give TypeScript enough signature shape to type-check
 * middleware.ts without forcing a project-wide tsconfig upgrade. Runtime
 * resolution is handled by Node.js itself, which DOES understand exports.
 */

declare module '@x402/hono' {
  import type { MiddlewareHandler } from 'hono';

  /**
   * Build a Hono middleware from an x402 route config + facilitator(s) +
   * payment scheme(s). Returns a middleware that intercepts the listed
   * routes, negotiates HTTP 402 when X-PAYMENT is missing, and forwards
   * verified-paid requests to the downstream handler.
   */
  export function paymentMiddlewareFromConfig(
    routes: Record<string, unknown>,
    facilitators?: unknown,
    schemes?: unknown,
  ): MiddlewareHandler;
}

declare module '@x402/core/server' {
  /**
   * HTTP client for an x402 facilitator (e.g. OZ Channels). Handles
   * /verify, /settle, and /supported calls with optional auth headers.
   */
  export class HTTPFacilitatorClient {
    constructor(config: {
      url?: string;
      createAuthHeaders?: () => Promise<{
        verify: Record<string, string>;
        settle: Record<string, string>;
        supported: Record<string, string>;
      }>;
    });
  }
}

declare module '@x402/stellar/exact/server' {
  /**
   * Server-side Stellar `exact` scheme implementation. Verifies Soroban
   * auth entries against the advertised payment requirements.
   */
  export class ExactStellarScheme {
    constructor();
  }
}
