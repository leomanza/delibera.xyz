#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.sandbox"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  cp $SCRIPT_DIR/../.env.sandbox.example $ENV_FILE"
  echo "  # then fill in NEAR_AI_API_KEY, ENSUE_API_KEY, ENSUE_COORDINATOR_ORG"
  exit 1
fi
set -a; source "$ENV_FILE"; set +a
mkdir -p "${IRONCLAW_HOME:-~/.ironclaw-sandbox}/skills/delibera-worker"
echo "[sandbox] Starting IronClaw with IRONCLAW_HOME=${IRONCLAW_HOME:-~/.ironclaw-sandbox} ..."
ironclaw run
