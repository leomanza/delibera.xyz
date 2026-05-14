/**
 * @delibera-xyz/ensue-client
 *
 * Standalone HTTP client for the Ensue Memory Network API.
 * JSON-RPC 2.0 over Server-Sent Events.
 *
 * Usage:
 *   import { EnsueClient, createEnsueClient } from '@delibera-xyz/ensue-client';
 *
 *   // Explicit config (preferred):
 *   const client = new EnsueClient({ apiKey: 'your-key' });
 *
 *   // Convenience factory (reads process.env):
 *   const client = createEnsueClient();
 */

export { EnsueClient, createEnsueClient } from './ensue-client';
export type { IMemoryClient, EnsueClientConfig, Logger } from './types';
