#!/bin/bash
# Start the coordinator-agent locally for Step 5.5 (coordinator + 1 IronClaw worker integration test).
#
# Prerequisites:
#   - sandbox/.env.coordinator exists and is filled in (copy from .env.coordinator.example)
#   - IronClaw worker is already running on http://127.0.0.1:8080
#   - Ensue MCP server is already running on http://127.0.0.1:7800
#   - coordinator-agent dependencies installed (`cd coordinator-agent && npm install`)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.coordinator"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  cp $SCRIPT_DIR/../.env.coordinator.example $ENV_FILE"
  echo "  # then paste your ENSUE_API_KEY"
  exit 1
fi

# Sanity check the worker is reachable before starting the coordinator
WORKER_URL=$(grep -E "^WORKERS=" "$ENV_FILE" | head -1 | cut -d'|' -f2)
if [ -n "$WORKER_URL" ]; then
  if ! curl -s -o /dev/null --max-time 3 "$WORKER_URL/" 2>/dev/null; then
    echo "[coordinator-sandbox] WARN: worker endpoint $WORKER_URL is not reachable."
    echo "  Make sure IronClaw is running (Terminal 2)."
    echo "  Continuing anyway — coordinator will mark the worker unreachable and abort."
    echo ""
  fi
fi

echo "[coordinator-sandbox] Starting coordinator-agent in LOCAL_MODE..."
echo "[coordinator-sandbox] WORKERS: $(grep ^WORKERS= "$ENV_FILE" | cut -d'=' -f2-)"
echo ""

cd "$REPO_ROOT/coordinator-agent"
DOTENV_CONFIG_PATH="$ENV_FILE" npx tsx -r dotenv/config src/index.ts
