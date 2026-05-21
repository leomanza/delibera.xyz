#!/bin/bash
# Start the coordinator-agent locally for Step 5.6 (coordinator + 3 Dockerized workers).
# Variant of start-coordinator.sh that uses sandbox/.env.coordinator-multi.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.coordinator-multi"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  cp $SCRIPT_DIR/../.env.coordinator-multi.example $ENV_FILE"
  echo "  # then paste your ENSUE_API_KEY"
  exit 1
fi

echo "[coordinator-multi] Starting coordinator-agent in LOCAL_MODE..."
echo "[coordinator-multi] WORKERS: $(grep ^WORKERS= "$ENV_FILE" | cut -d'=' -f2-)"
echo ""

cd "$REPO_ROOT/coordinator-agent"
DOTENV_CONFIG_PATH="$ENV_FILE" npx tsx -r dotenv/config src/index.ts
