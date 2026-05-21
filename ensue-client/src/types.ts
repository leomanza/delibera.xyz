/**
 * @delibera-xyz/ensue-client — Type definitions
 *
 * Ports (interfaces) and configuration types for the Ensue Memory Network client.
 * Consumers should program against IMemoryClient, not the concrete EnsueClient class.
 */

/**
 * Port — the contract consumers depend on.
 *
 * Any class that can read/write memory entries in a key-value store
 * (Ensue, local cache, mock, etc.) implements this interface.
 *
 * Used by:
 *  - ensue-mcp-server (exposes these operations as MCP tools)
 *  - NameResolver (reads display names)
 *  - coordinator/worker agents (read/write coordination state)
 */
export interface IMemoryClient {
  /** Create a new memory entry */
  createMemory(key: string, value: string | object, description?: string): Promise<void>;

  /** Read a single value by key. Returns null if not found. */
  readMemory(key: string): Promise<string | null>;

  /** Read multiple values by keys. Returns a map of key → value. */
  readMultiple(keys: string[]): Promise<Record<string, string>>;

  /** Update an existing memory value (upserts if not found). */
  updateMemory(key: string, value: string | object): Promise<void>;

  /** Delete a memory entry by key. */
  deleteMemory(key: string): Promise<void>;

  /** List memory keys matching an optional prefix. */
  listKeys(prefix?: string, limit?: number): Promise<string[]>;

  /** Semantic search across memories. */
  searchMemories(query: string, limit?: number): Promise<any[]>;

  /** Delete all memories matching a prefix. */
  clearPrefix(prefix: string): Promise<void>;
}

/**
 * Explicit configuration for EnsueClient.
 *
 * No process.env reads inside the library — config is passed in explicitly.
 * The convenience factory `createEnsueClient()` reads env vars as a
 * backward-compatible shortcut, but new code should prefer this config object.
 */
export interface EnsueClientConfig {
  /** Ensue API key (required) */
  apiKey: string;

  /** Base URL for the Ensue API (default: https://api.ensue-network.ai/) */
  baseURL?: string;

  /** Request timeout in ms (default: 15000) */
  timeout?: number;

  /** Logger instance — defaults to console. Pass a no-op logger to silence. */
  logger?: Logger;
}

/**
 * Logger interface for dependency injection.
 * Compatible with console, pino, winston, etc.
 */
export interface Logger {
  error(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
}
