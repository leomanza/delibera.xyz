# @delibera-xyz/ensue-client

Standalone TypeScript client for the [Ensue Memory Network](https://ensue-network.ai/) API.

Ensue provides persistent, shared key-value memory for AI agents. This client wraps the JSON-RPC 2.0 over SSE protocol into a clean async interface.

## Install

```bash
npm install @delibera-xyz/ensue-client
```

## Quick Start

```typescript
import { EnsueClient } from '@delibera-xyz/ensue-client';

const client = new EnsueClient({ apiKey: 'your-ensue-api-key' });

// Write
await client.createMemory('agent/preferences', JSON.stringify({ theme: 'dark' }));

// Read
const value = await client.readMemory('agent/preferences');
console.log(value); // '{"theme":"dark"}'

// Update
await client.updateMemory('agent/preferences', { theme: 'light' });

// Search
const results = await client.searchMemories('preferences');

// List keys
const keys = await client.listKeys('agent/');

// Delete
await client.deleteMemory('agent/preferences');

// Bulk delete by prefix
await client.clearPrefix('agent/temp/');
```

## Configuration

### Explicit config (recommended)

```typescript
import { EnsueClient } from '@delibera-xyz/ensue-client';

const client = new EnsueClient({
  apiKey: 'your-key',
  baseURL: 'https://api.ensue-network.ai/',  // default
  timeout: 15000,                              // ms, default
  logger: console,                             // any Logger-compatible object
});
```

### Environment variable shortcut

```typescript
import { createEnsueClient } from '@delibera-xyz/ensue-client';

// Reads ENSUE_API_KEY or ENSUE_TOKEN from process.env
const client = createEnsueClient();
```

> **Note:** `createEnsueClient()` is a convenience wrapper. For library code, testable code, or non-Node.js environments, prefer the explicit `new EnsueClient({ apiKey })` constructor.

## API Reference

### `EnsueClient`

The main client class. Implements `IMemoryClient`.

| Method | Signature | Description |
|---|---|---|
| `createMemory` | `(key, value, description?) → Promise<void>` | Create a new memory entry |
| `readMemory` | `(key) → Promise<string \| null>` | Read a single value. Returns `null` if not found |
| `readMultiple` | `(keys) → Promise<Record<string, string>>` | Batch read. Returns a key→value map |
| `updateMemory` | `(key, value) → Promise<void>` | Update a value (upserts if not found) |
| `deleteMemory` | `(key) → Promise<void>` | Delete a single entry |
| `listKeys` | `(prefix?, limit?) → Promise<string[]>` | List keys matching a prefix |
| `searchMemories` | `(query, limit?) → Promise<any[]>` | Semantic search across memories |
| `clearPrefix` | `(prefix) → Promise<void>` | Delete all keys matching a prefix |

Values can be strings or objects (objects are JSON-stringified automatically).

### `IMemoryClient` (interface)

The port interface that `EnsueClient` implements. Use this type when you want to:

- Accept any memory backend (Ensue, local cache, mock)
- Write testable code without mocking HTTP internals
- Build adapters for other storage systems

```typescript
import type { IMemoryClient } from '@delibera-xyz/ensue-client';

class MyService {
  constructor(private memory: IMemoryClient) {}

  async getConfig(key: string): Promise<string | null> {
    return this.memory.readMemory(key);
  }
}

// Production
const service = new MyService(new EnsueClient({ apiKey: '...' }));

// Test
const mockMemory: IMemoryClient = {
  readMemory: async (key) => 'mock-value',
  createMemory: async () => {},
  readMultiple: async () => ({}),
  updateMemory: async () => {},
  deleteMemory: async () => {},
  listKeys: async () => [],
  searchMemories: async () => [],
  clearPrefix: async () => {},
};
const testService = new MyService(mockMemory);
```

### `EnsueClientConfig`

```typescript
interface EnsueClientConfig {
  apiKey: string;        // Required — your Ensue API key
  baseURL?: string;      // Default: 'https://api.ensue-network.ai/'
  timeout?: number;      // Default: 15000 (ms)
  logger?: Logger;       // Default: console
}
```

### `Logger`

Compatible with `console`, `pino`, `winston`, or any object with an `error` method:

```typescript
interface Logger {
  error(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
}
```

## Cross-Organization Reads

Ensue supports reading memories from other organizations using the `@org-name/` prefix:

```typescript
const value = await client.readMemory('@other-org/shared/config');
```

## Protocol Details

- **Transport:** HTTP POST to Ensue API
- **Protocol:** JSON-RPC 2.0
- **Response format:** Server-Sent Events (SSE) with `data:` lines containing JSON-RPC payloads
- **Authentication:** Bearer token via `Authorization` header
- **Error handling:** Automatic retry on upsert (update falls back to create if key doesn't exist)

## Architecture

```
Your application
  └─ EnsueClient (this package)
        └─ HTTP (axios)
              └─ Ensue Network API (api.ensue-network.ai)
                    └─ Persistent shared memory
```

## License

MIT
