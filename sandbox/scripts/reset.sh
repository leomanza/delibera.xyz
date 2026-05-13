#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.sandbox"
[ -f "$ENV_FILE" ] && { set -a; source "$ENV_FILE"; set +a; }
WS="${IRONCLAW_HOME:-$HOME/.ironclaw}"
echo "[sandbox] Resetting workspace: $WS"
rm -rf "$WS"
mkdir -p "$WS/skills/delibera-worker"
echo "[sandbox] Done. Run sync-skill.sh then start.sh."
