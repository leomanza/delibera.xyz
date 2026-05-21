# @delibera-xyz/ensue-mcp-server

MCP server that exposes [Ensue Memory Network](https://ensue-network.ai/) operations as tools for any MCP-compatible AI agent.

Built on the [Model Context Protocol](https://modelcontextprotocol.io/) SDK with `StreamableHTTPServerTransport` — works with Claude Desktop, IronClaw, Cursor, and any MCP client that speaks HTTP + JSON-RPC 2.0.

## Tools

| Tool | Parameters | Description |
|---|---|---|
| `ensue_read_memory` | `key: string` | Read a single memory value by key |
| `ensue_write_memory` | `key: string, value: string` | Create or update a memory value |
| `ensue_list_keys` | `prefix?: string, limit?: number` | List keys matching a prefix |
| `ensue_search_memories` | `query: string, limit?: number` | Semantic search across memories |

Keys support the `@org-name/` prefix for cross-organization reads.

## Quick Start

### 1. Set your API key

```bash
export ENSUE_API_KEY=<your-ensue-api-key>
```

### 2. Build and run

```bash
npm install
npm run build
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 3. Verify

```bash
curl -s http://127.0.0.1:7800/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `ENSUE_API_KEY` | *(required)* | Your Ensue Memory Network API key |
| `PORT` | `7800` | HTTP port to listen on |
| `HOST` | `127.0.0.1` | Bind address |

## Registering with an MCP Client

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ensue": {
      "url": "http://127.0.0.1:7800/mcp"
    }
  }
}
```

### IronClaw

```bash
ironclaw mcp add ensue http://127.0.0.1:7800/mcp
ironclaw mcp list   # verify: should show "ensue"
```

### Cursor / Other MCP clients

Point your client to `http://<host>:<port>/mcp` using Streamable HTTP transport.

## Session Management

The server supports multiple concurrent MCP sessions. Each session is identified by a `Mcp-Session-Id` header:

- **`POST /mcp`** — Initialize a session or call tools. Returns `Mcp-Session-Id` in response headers.
- **`GET /mcp`** — SSE stream for server-to-client notifications (optional).
- **`DELETE /mcp`** — Close a session and free resources.

Sessions are automatically cleaned up on disconnect.

## Deployment

### Standalone (any server)

```bash
git clone <this-repo>
cd ensue-mcp-server
npm install --omit=dev
npm run build
ENSUE_API_KEY=<key> node dist/index.js
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ dist/
ENV PORT=7800
EXPOSE 7800
CMD ["node", "dist/index.js"]
```

### systemd

```ini
[Unit]
Description=Ensue MCP Server
After=network.target

[Service]
Type=simple
Environment=ENSUE_API_KEY=<key>
Environment=PORT=7800
ExecStart=/usr/bin/node /opt/ensue-mcp-server/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### tmux (quick dev/VPS setup)

```bash
tmux new-session -d -s ensue-mcp \
  "ENSUE_API_KEY=<key> node /opt/ensue-mcp-server/dist/index.js"
```

## Architecture

```
MCP Client (Claude, IronClaw, Cursor, etc.)
  └─ HTTP POST /mcp (JSON-RPC 2.0)
        └─ Ensue MCP Server (this package)
              └─ @delibera-xyz/ensue-client
                    └─ Ensue Network API (api.ensue-network.ai)
                          └─ Persistent shared memory
```

## Dependencies

| Package | Purpose |
|---|---|
| `@delibera-xyz/ensue-client` | Ensue Memory Network HTTP client |
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `zod` | Tool input schema validation |

## License

MIT
