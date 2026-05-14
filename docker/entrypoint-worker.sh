#!/bin/bash
# Delibera IronClaw worker entrypoint.
#
# Runs TWO processes in the container:
#   1. Ensue MCP server on 127.0.0.1:7800 (background)
#   2. IronClaw v0.28.1 on 0.0.0.0:8080 (foreground, PID 1 after exec)
#
# IronClaw v0.28.1 rejects non-loopback http:// MCP URLs, so the MCP server
# must run inside the container at 127.0.0.1.
#
# Required env vars (set per container via docker-compose):
#   WORKER_DID                — the worker's unique DID (e.g., did:key:z6Mk...)
#   ENSUE_API_KEY             — the Ensue API key (shared in sandbox)
#   HTTP_WEBHOOK_SECRET       — webhook auth secret shared with the coordinator
#   NEAR_AI_API_KEY           — LLM provider key (NEAR AI; rewritten to NEARAI_API_KEY for IronClaw v0.28.1)
#
# Optional:
#   WORKER_NEAR_ACCOUNT, ENSUE_COORDINATOR_ORG, COORDINATOR_CONTRACT, IRONCLAW_MODEL
set -e

: "${WORKER_DID:?WORKER_DID is required}"
: "${ENSUE_API_KEY:?ENSUE_API_KEY is required (for the bundled MCP server)}"
: "${HTTP_WEBHOOK_SECRET:?HTTP_WEBHOOK_SECRET is required}"
: "${NEAR_AI_API_KEY:?NEAR_AI_API_KEY is required}"

WORKER_NEAR_ACCOUNT="${WORKER_NEAR_ACCOUNT:-sandbox-worker.testnet}"
ENSUE_COORDINATOR_ORG="${ENSUE_COORDINATOR_ORG:-delibera_coordinator}"
COORDINATOR_CONTRACT="${COORDINATOR_CONTRACT:-registry.agents-coordinator.testnet}"
IRONCLAW_MODEL="${IRONCLAW_MODEL:-Qwen/Qwen3.5-122B-A10B}"

IRONCLAW_HOME="${HOME}/.ironclaw"
mkdir -p "$IRONCLAW_HOME/skills/delibera-worker"

# Container-local: worker shares org with coordinator → direct key path (no @org/ prefix).
TASK_DEFINITION_KEY="${TASK_DEFINITION_KEY:-coordination/config/task_definition}"

echo "[entrypoint] Rendering skill + identity files for WORKER_DID=$WORKER_DID"

# Render SKILL.md (substitute ${VAR} placeholders)
sed \
  -e "s|\${WORKER_DID}|$WORKER_DID|g" \
  -e "s|\${WORKER_NEAR_ACCOUNT}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|\${ENSUE_COORDINATOR_ORG}|$ENSUE_COORDINATOR_ORG|g" \
  -e "s|\${TASK_DEFINITION_KEY}|$TASK_DEFINITION_KEY|g" \
  /opt/delibera-skills/delibera-worker/SKILL.md \
  > "$IRONCLAW_HOME/skills/delibera-worker/SKILL.md"

# Render IDENTITY.md ({{PLACEHOLDER}} syntax)
sed \
  -e "s|{{WORKER_DID}}|$WORKER_DID|g" \
  -e "s|{{WORKER_NEAR_ACCOUNT}}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|{{COORDINATOR_CONTRACT}}|$COORDINATOR_CONTRACT|g" \
  /opt/delibera-skills/delibera-worker-identity/IDENTITY.md \
  > "$IRONCLAW_HOME/IDENTITY.md"

sed \
  -e "s|{{WORKER_DID}}|$WORKER_DID|g" \
  -e "s|{{WORKER_NEAR_ACCOUNT}}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|{{ENSUE_COORDINATOR_ORG}}|$ENSUE_COORDINATOR_ORG|g" \
  /opt/delibera-skills/delibera-worker-identity/USER.md \
  > "$IRONCLAW_HOME/USER.md"

cp /opt/delibera-skills/delibera-worker-identity/AGENTS.md "$IRONCLAW_HOME/AGENTS.md"
cp /opt/delibera-skills/delibera-worker-identity/SOUL.md   "$IRONCLAW_HOME/SOUL.md"

# Write the IronClaw env file.
# CLI_ENABLED=false + CLI_MODE=repl disables both TUI and REPL channels —
# REQUIRED for headless containers without a TTY. The HTTP webhook channel
# stays on so the coordinator can dispatch.
cat > "$IRONCLAW_HOME/.env" <<EOF
DATABASE_BACKEND=libsql
LIBSQL_PATH=${IRONCLAW_HOME}/ironclaw.db
LLM_BACKEND=nearai
NEARAI_MODEL=${IRONCLAW_MODEL}
NEARAI_API_KEY=${NEAR_AI_API_KEY}
CLI_ENABLED=false
CLI_MODE=repl
HTTP_ENABLED=true
HTTP_HOST=0.0.0.0
HTTP_PORT=8080
HTTP_WEBHOOK_SECRET=${HTTP_WEBHOOK_SECRET}
HEARTBEAT_ENABLED=true
HEARTBEAT_INTERVAL_SECS=60
WORKER_DID=${WORKER_DID}
WORKER_NEAR_ACCOUNT=${WORKER_NEAR_ACCOUNT}
ENSUE_COORDINATOR_ORG=${ENSUE_COORDINATOR_ORG}
EOF

# Start the Ensue MCP server in the background, bound to loopback only
echo "[entrypoint] Starting Ensue MCP server on 127.0.0.1:7800 ..."
(
  cd /opt/mcp \
  && ENSUE_API_KEY="$ENSUE_API_KEY" \
     HOST=127.0.0.1 \
     PORT=7800 \
     node dist/index.js \
) &
MCP_PID=$!

# Wait for it to be reachable (loopback)
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:7800/mcp \
       -H 'Content-Type: application/json' -d '{}' 2>/dev/null | grep -qE '^(2|3|4)'; then
    echo "[entrypoint] Ensue MCP server up (pid=$MCP_PID)."
    break
  fi
  sleep 1
done

# Register the MCP with IronClaw (idempotent — re-add is fine).
# This also seeds the SQLite DB with default settings on first run.
ironclaw mcp add ensue http://127.0.0.1:7800/mcp 2>&1 || \
  echo "[entrypoint] mcp add returned non-zero (likely already registered)"

# Set CLI channel to REPL mode (not TUI) — the docker-compose service has
# tty:true + stdin_open:true, so a pseudo-TTY exists and IronClaw's REPL
# channel can initialize without rendering a full TUI. The agent loop then
# reaches the main message-processing block.
# DB values take priority over env vars, so we set via the CLI here.
echo "[entrypoint] Setting CLI channel = REPL (headless container with pty) ..."
ironclaw config set channels.cli_mode repl 2>&1 | head -3
ironclaw config set channels.cli_enabled true 2>&1 | head -3

# Supervisor mode: run IronClaw as a child of THIS shell (not via `exec`) so
# the cleanup trap fires whether the container is signalled OR IronClaw exits
# on its own. With `exec ironclaw` the shell would be replaced, discarding the
# trap, and an IronClaw crash would orphan the MCP child until the container died.
cleanup() {
  local exit_code=$?
  echo "[entrypoint] shutting down (exit=$exit_code) — killing MCP server (pid=$MCP_PID)"
  kill "$MCP_PID" 2>/dev/null || true
  # Give MCP a moment to flush logs, then force-kill if still alive.
  sleep 1
  kill -9 "$MCP_PID" 2>/dev/null || true
}
trap cleanup TERM INT EXIT

# Propagate SIGTERM/SIGINT to IronClaw immediately when the container stops.
forward_signal() {
  local sig=$1
  echo "[entrypoint] received $sig — forwarding to ironclaw (pid=$IRONCLAW_PID)"
  kill -"$sig" "$IRONCLAW_PID" 2>/dev/null || true
}
trap 'forward_signal TERM' TERM
trap 'forward_signal INT'  INT

# Start IronClaw as a child of this shell so the trap above stays active.
echo "[entrypoint] Starting IronClaw on 0.0.0.0:8080 ..."
ironclaw run --no-onboard &
IRONCLAW_PID=$!
wait "$IRONCLAW_PID"
IRONCLAW_EXIT=$?
echo "[entrypoint] ironclaw exited with code $IRONCLAW_EXIT"
exit "$IRONCLAW_EXIT"
