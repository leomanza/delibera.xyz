# Ensue MCP Server

Exposes Ensue Memory Network to MCP clients (e.g., IronClaw workers).

## Tools

- `ensue_read_memory(key)` — read a single value
- `ensue_write_memory(key, value)` — create or update a value
- `ensue_list_keys(prefix?, limit?)` — list keys under a prefix
- `ensue_search_memories(query, limit?)` — semantic search

Keys can use the `@org-name/` prefix for cross-org reads.

## Run

```bash
export ENSUE_API_KEY=<your-key>
npm run build && npm start
# or for dev:
npm run dev
```

Listens on `http://127.0.0.1:7800/mcp` by default. Override with `PORT` / `HOST` env vars.

## Register with IronClaw

On the same machine where this MCP server is running:

```bash
ironclaw mcp add ensue http://127.0.0.1:7800/mcp
ironclaw mcp list   # should show "ensue"
```

## Deployment (on an IronClaw worker VPS)

The SSH configurator at `protocol-api/src/ironclaw/ironclaw-ssh-configurator.ts` deploys this server alongside IronClaw:

1. Installs Node.js
2. Copies the built `dist/` + `node_modules/` to `/opt/ensue-mcp-server/`
3. Starts it in a dedicated tmux session
4. Registers it with IronClaw via `ironclaw mcp add`

## Architecture

```
IronClaw agent
  └─ MCP client (HTTP, JSON-RPC 2.0)
        └─ Ensue MCP server (this package, port 7800)
              └─ EnsueClient (from @near-shade-coordination/shared)
                    └─ Ensue Network API (api.ensue-network.ai)
```
