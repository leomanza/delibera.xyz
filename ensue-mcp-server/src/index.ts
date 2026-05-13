#!/usr/bin/env node
/**
 * Ensue MCP Server
 *
 * Exposes Ensue Memory Network read/write tools to MCP clients (e.g., IronClaw).
 * Designed to be deployed alongside an IronClaw worker on its VPS, bound to localhost.
 *
 * Environment variables required:
 *   ENSUE_API_KEY      — the worker's Ensue API key
 *
 * Optional:
 *   PORT               — HTTP listen port (default: 7800)
 *   HOST               — bind address (default: 127.0.0.1)
 *
 * Register with IronClaw on the same machine:
 *   ironclaw mcp add ensue http://127.0.0.1:7800/mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { createEnsueClient, EnsueClient } from '@near-shade-coordination/shared';

const PORT = parseInt(process.env.PORT ?? '7800', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

if (!process.env.ENSUE_API_KEY) {
  console.error('ENSUE_API_KEY env var is required');
  process.exit(1);
}

// One shared EnsueClient — it's stateless beyond the API key.
const ensue: EnsueClient = createEnsueClient();

// ── Tool definitions ──

const TOOLS: Tool[] = [
  {
    name: 'ensue_read_memory',
    description:
      'Read a single value from Ensue Memory Network. Returns null if the key does not exist. ' +
      'Keys can use the @org-name/ prefix to read from another agent\'s namespace (cross-org reads).',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The memory key path (e.g., "coordination/tasks/did:key:.../status" or "@org/path/to/key")',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'ensue_write_memory',
    description:
      'Write (create or update) a value in Ensue Memory Network. Stores under the authenticated API key\'s namespace. ' +
      'Use this to publish vote results and status updates to the shared coordination namespace.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The memory key path to write to',
        },
        value: {
          type: 'string',
          description: 'The value to store. JSON should be pre-stringified.',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'ensue_list_keys',
    description:
      'List memory keys matching an optional prefix. Returns up to `limit` keys. ' +
      'Useful for discovering what is stored under a namespace.',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Optional key prefix to filter (e.g., "coordination/tasks/")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of keys to return (default 100)',
        },
      },
    },
  },
  {
    name: 'ensue_search_memories',
    description:
      'Semantic search across memories. Returns up to `limit` results ranked by relevance to the query. ' +
      'Useful for finding past deliberations, proposals, or related context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 5)',
        },
      },
      required: ['query'],
    },
  },
];

// ── MCP server setup ──

function buildServer(): Server {
  const server = new Server(
    {
      name: 'ensue-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    try {
      switch (name) {
        case 'ensue_read_memory': {
          const key = String(args?.key ?? '');
          if (!key) throw new Error('key is required');
          const value = await ensue.readMemory(key);
          return {
            content: [{ type: 'text', text: value ?? '' }],
          };
        }

        case 'ensue_write_memory': {
          const key = String(args?.key ?? '');
          const value = String(args?.value ?? '');
          if (!key) throw new Error('key is required');
          await ensue.updateMemory(key, value);
          return {
            content: [{ type: 'text', text: 'ok' }],
          };
        }

        case 'ensue_list_keys': {
          const prefix = args?.prefix ? String(args.prefix) : undefined;
          const limit = typeof args?.limit === 'number' ? args.limit : 100;
          const keys = await ensue.listKeys(prefix, limit);
          return {
            content: [{ type: 'text', text: JSON.stringify(keys) }],
          };
        }

        case 'ensue_search_memories': {
          const query = String(args?.query ?? '');
          if (!query) throw new Error('query is required');
          const limit = typeof args?.limit === 'number' ? args.limit : 5;
          const results = await ensue.searchMemories(query, limit);
          return {
            content: [{ type: 'text', text: JSON.stringify(results) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${msg}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ── HTTP transport ──
// Streamable HTTP transport requires per-session state. We hold a transport
// per session ID (returned to the client via `mcp-session-id` header on first
// initialize). Subsequent requests must include that header.

const transports: Map<string, StreamableHTTPServerTransport> = new Map();

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function main(): Promise<void> {
  const httpServer = http.createServer();

  httpServer.on('request', async (req, res) => {
    const url = (req.url ?? '').split('?')[0];
    if (url !== '/mcp' && url !== '/mcp/') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }));
      return;
    }

    try {
      const sessionId = (req.headers['mcp-session-id'] as string | undefined) ?? undefined;
      const body = await readBody(req);

      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        // No active session — only allow initialize requests to create one
        if (!isInitializeRequest(body)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: Server not initialized' },
            id: null,
          }));
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports.set(id, transport!);
            console.log(`[ensue-mcp] session initialized: ${id}`);
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) {
            transports.delete(transport!.sessionId);
            console.log(`[ensue-mcp] session closed: ${transport!.sessionId}`);
          }
        };

        const server = buildServer();
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[ensue-mcp] request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  httpServer.on('error', (err) => {
    console.error('[ensue-mcp] http server error:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[ensue-mcp] listening on http://${HOST}:${PORT}/mcp`);
    console.log(`[ensue-mcp] tools: ${TOOLS.map((t) => t.name).join(', ')}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[ensue-mcp] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    // Force exit after 5s if close hangs
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[ensue-mcp] fatal:', err);
  process.exit(1);
});
