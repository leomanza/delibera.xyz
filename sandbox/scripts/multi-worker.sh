#!/bin/bash
# Multi-worker sandbox manager — runs 3 native IronClaw processes with isolated
# HOME dirs so they each have their own ~/.ironclaw/ workspace.
#
# Pre-requisites:
#   - IronClaw installed natively (same install used by Step 5 sandbox)
#   - Node.js 20+ (for the bundled Ensue MCP server)
#   - shared/ + ensue-client/ + ensue-mcp-server/ all built (dist/ exists)
#   - sandbox/.env.sandbox filled in (ENSUE_API_KEY, NEAR_AI_API_KEY at minimum)
#
# Usage:
#   bash sandbox/scripts/multi-worker.sh start       — start MCP + 3 workers in tmux
#   bash sandbox/scripts/multi-worker.sh status      — show what's running
#   bash sandbox/scripts/multi-worker.sh logs <N>    — attach to worker N's tmux session (Ctrl+B then d to detach)
#   bash sandbox/scripts/multi-worker.sh stop        — kill MCP + workers, leave workspaces
#   bash sandbox/scripts/multi-worker.sh reset       — stop + wipe ~/.delibera-w{1,2,3}/
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.sandbox"

WORKER_PORTS=(8080 8081 8082)
WORKER_DIDS=("did:key:sandbox-w1" "did:key:sandbox-w2" "did:key:sandbox-w3")
WORKER_NEAR_ACCOUNTS=("sandbox-w1.testnet" "sandbox-w2.testnet" "sandbox-w3.testnet")
WORKER_HOMES=("$HOME/.delibera-w1" "$HOME/.delibera-w2" "$HOME/.delibera-w3")
MCP_PORT=7800

require_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found. cp sandbox/.env.sandbox.example and fill in." >&2
    exit 1
  fi
  set -a; source "$ENV_FILE"; set +a
  for v in ENSUE_API_KEY NEAR_AI_API_KEY HTTP_WEBHOOK_SECRET ENSUE_COORDINATOR_ORG; do
    if [ -z "${!v}" ]; then echo "ERROR: $v is empty in $ENV_FILE" >&2; exit 1; fi
  done
}

render_worker_files() {
  local idx=$1
  local home="${WORKER_HOMES[$idx]}"
  local did="${WORKER_DIDS[$idx]}"
  local account="${WORKER_NEAR_ACCOUNTS[$idx]}"
  local port="${WORKER_PORTS[$idx]}"
  local skills_src="$REPO_ROOT/coordinator-agent/src/skills"
  mkdir -p "$home/.ironclaw/skills/delibera-worker"

  # Same-org sandbox → no @org prefix
  local task_key="coordination/config/task_definition"

  sed \
    -e "s|\${WORKER_DID}|$did|g" \
    -e "s|\${WORKER_NEAR_ACCOUNT}|$account|g" \
    -e "s|\${ENSUE_COORDINATOR_ORG}|$ENSUE_COORDINATOR_ORG|g" \
    -e "s|\${TASK_DEFINITION_KEY}|$task_key|g" \
    "$skills_src/delibera-worker/SKILL.md" > "$home/.ironclaw/skills/delibera-worker/SKILL.md"

  cp "$skills_src/delibera-worker-identity/AGENTS.md" "$home/.ironclaw/AGENTS.md"
  cp "$skills_src/delibera-worker-identity/SOUL.md"   "$home/.ironclaw/SOUL.md"

  sed \
    -e "s|{{WORKER_DID}}|$did|g" \
    -e "s|{{WORKER_NEAR_ACCOUNT}}|$account|g" \
    -e "s|{{COORDINATOR_CONTRACT}}|registry.agents-coordinator.testnet|g" \
    "$skills_src/delibera-worker-identity/IDENTITY.md" > "$home/.ironclaw/IDENTITY.md"

  sed \
    -e "s|{{WORKER_DID}}|$did|g" \
    -e "s|{{WORKER_NEAR_ACCOUNT}}|$account|g" \
    -e "s|{{ENSUE_COORDINATOR_ORG}}|$ENSUE_COORDINATOR_ORG|g" \
    "$skills_src/delibera-worker-identity/USER.md" > "$home/.ironclaw/USER.md"

  # Generate a per-worker 32-byte master key if we don't have one yet.
  # IMPORTANT: setting SECRETS_MASTER_KEY in env makes IronClaw skip the macOS
  # keychain entirely (otherwise it pops a "keychain not found" dialog and stalls).
  local key_file="$home/.ironclaw/master_key.hex"
  local master_key
  if [ -f "$key_file" ]; then
    master_key=$(cat "$key_file")
  else
    master_key=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    echo "$master_key" > "$key_file"
    chmod 600 "$key_file"
  fi

  # Write IronClaw bootstrap .env BEFORE any ironclaw command runs.
  # IronClaw's bootstrap::load_ironclaw_env() reads $HOME/.ironclaw/.env at startup
  # and requires DATABASE_BACKEND (else: "Missing required setting 'DATABASE_URL'").
  # We force libsql with a per-worker DB path to keep each worker fully isolated.
  cat > "$home/.ironclaw/.env" <<EOF
DATABASE_BACKEND=libsql
LIBSQL_PATH=$home/.ironclaw/ironclaw.db
SECRETS_MASTER_KEY=$master_key
LLM_BACKEND=nearai
NEARAI_MODEL=${IRONCLAW_MODEL:-Qwen/Qwen3.5-122B-A10B}
NEARAI_API_KEY=$NEAR_AI_API_KEY
HTTP_ENABLED=true
HTTP_HOST=0.0.0.0
HTTP_PORT=$port
HTTP_WEBHOOK_SECRET=$HTTP_WEBHOOK_SECRET
HEARTBEAT_ENABLED=true
HEARTBEAT_INTERVAL_SECS=60
WORKER_DID=$did
WORKER_NEAR_ACCOUNT=$account
ENSUE_COORDINATOR_ORG=$ENSUE_COORDINATOR_ORG
EOF
}

start_mcp() {
  if pgrep -f "ensue-mcp-server/dist/index.js" >/dev/null 2>&1; then
    echo "[multi-worker] Ensue MCP server already running on :$MCP_PORT"
    return 0
  fi
  echo "[multi-worker] Starting Ensue MCP server on :$MCP_PORT (tmux session: delibera-mcp)"
  tmux kill-session -t delibera-mcp 2>/dev/null || true
  tmux new-session -d -s delibera-mcp \
    "cd '$REPO_ROOT/ensue-mcp-server' && ENSUE_API_KEY='$ENSUE_API_KEY' HOST=127.0.0.1 PORT=$MCP_PORT node dist/index.js 2>&1 | tee /tmp/delibera-mcp.log"
  sleep 2
}

start_worker() {
  local idx=$1
  local home="${WORKER_HOMES[$idx]}"
  local did="${WORKER_DIDS[$idx]}"
  local port="${WORKER_PORTS[$idx]}"
  local session="delibera-w$((idx + 1))"

  if pgrep -f "HOME=$home ironclaw run" >/dev/null 2>&1 || pgrep -f "$home/.ironclaw" >/dev/null 2>&1; then
    echo "[multi-worker] Worker $((idx + 1)) ($did) already running on :$port"
    return 0
  fi

  echo "[multi-worker] Worker $((idx + 1)): HOME=$home → http://127.0.0.1:$port (tmux session: $session)"
  render_worker_files "$idx"

  # Register the MCP server in this worker's DB. .env is already written, so the
  # DB is created with our libsql path and defaults are seeded.
  HOME="$home" ironclaw mcp add ensue "http://127.0.0.1:$MCP_PORT/mcp" 2>&1 | tail -3 || true

  # Override DB-seeded defaults (DB-first wins over env, so .env values are
  # ignored on subsequent reads — we must write per-worker overrides to DB):
  #   - channels.http_port: default 8080 → unique per worker
  #   - channels.http_host: default 127.0.0.1 → bind on all interfaces
  #   - channels.cli_mode:  default tui → repl (no stderr suppression in v0.28.1)
  HOME="$home" ironclaw config set channels.http_port "$port"  2>&1 | tail -1 || true
  HOME="$home" ironclaw config set channels.http_host 0.0.0.0  2>&1 | tail -1 || true
  HOME="$home" ironclaw config set channels.cli_mode  repl     2>&1 | tail -1 || true

  # Start in tmux. All config comes from .env in the worker's HOME.
  tmux kill-session -t "$session" 2>/dev/null || true
  tmux new-session -d -s "$session" \
    "HOME='$home' ironclaw run --no-onboard 2>&1 | tee /tmp/$session.log"
}

cmd_start() {
  require_env
  echo "[multi-worker] Building shared/ensue-client/mcp dist if needed..."
  ( cd "$REPO_ROOT/shared" && [ -f dist/index.js ] || npm run build ) >/dev/null 2>&1
  ( cd "$REPO_ROOT/ensue-client" && [ -f dist/index.js ] || npm run build ) >/dev/null 2>&1
  ( cd "$REPO_ROOT/ensue-mcp-server" && [ -f dist/index.js ] || npm run build ) >/dev/null 2>&1

  start_mcp
  for i in 0 1 2; do start_worker "$i"; sleep 1; done

  sleep 3
  echo ""
  echo "[multi-worker] Started. Verify with:"
  for i in 0 1 2; do
    local port="${WORKER_PORTS[$i]}"
    local did="${WORKER_DIDS[$i]}"
    echo "  curl -s http://127.0.0.1:$port/   # $did"
  done
  echo "  bash sandbox/scripts/multi-worker.sh logs 1   # tmux attach to worker1 log"
  echo "  bash sandbox/scripts/multi-worker.sh stop    # kill everything"
  echo ""
  echo "[multi-worker] Then in another terminal:"
  echo "  bash sandbox/scripts/start-coordinator-multi.sh"
}

cmd_status() {
  echo "[multi-worker] tmux sessions:"
  tmux list-sessions 2>/dev/null | grep -E "delibera-" || echo "  (none)"
  echo ""
  echo "[multi-worker] port checks:"
  for p in "$MCP_PORT" "${WORKER_PORTS[@]}"; do
    if lsof -nP -iTCP:$p -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
      echo "  :$p  LISTENING"
    else
      echo "  :$p  not listening"
    fi
  done
}

cmd_logs() {
  local n="${1:-1}"
  tmux attach -t "delibera-w$n"
}

cmd_stop() {
  for s in delibera-mcp delibera-w1 delibera-w2 delibera-w3; do
    tmux kill-session -t "$s" 2>/dev/null && echo "[multi-worker] Killed tmux session: $s" || true
  done
  # Belt-and-suspenders: kill any lingering ironclaw processes pointed at our HOMEs
  for h in "${WORKER_HOMES[@]}"; do
    pkill -f "HOME=$h" 2>/dev/null || true
  done
  pkill -f "ensue-mcp-server/dist/index.js" 2>/dev/null || true
}

cmd_reset() {
  cmd_stop
  for h in "${WORKER_HOMES[@]}"; do
    if [ -d "$h" ]; then
      echo "[multi-worker] Removing $h"
      rm -rf "$h"
    fi
  done
}

case "${1:-start}" in
  start)  cmd_start ;;
  status) cmd_status ;;
  logs)   cmd_logs "${2:-1}" ;;
  stop)   cmd_stop ;;
  reset)  cmd_reset ;;
  *)
    echo "Usage: $0 {start|status|logs <N>|stop|reset}"
    exit 1
    ;;
esac
