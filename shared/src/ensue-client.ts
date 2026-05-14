/**
 * Re-export facade — backward compatibility layer.
 *
 * EnsueClient and createEnsueClient now live in @delibera-xyz/ensue-client.
 * This file re-exports them so existing consumers importing from
 * @delibera-xyz/shared see no change.
 */
export { EnsueClient, createEnsueClient } from '@delibera-xyz/ensue-client';
export type { IMemoryClient, EnsueClientConfig, Logger } from '@delibera-xyz/ensue-client';
