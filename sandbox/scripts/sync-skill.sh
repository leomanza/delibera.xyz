#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.sandbox"
[ -f "$ENV_FILE" ] && { set -a; source "$ENV_FILE"; set +a; }
DEST="${IRONCLAW_HOME:-~/.ironclaw-sandbox}/skills/delibera-worker"
mkdir -p "$DEST"
cp "$REPO_ROOT/coordinator-agent/src/skills/delibera-worker/SKILL.md" "$DEST/"
echo "[sandbox] Synced SKILL.md → $DEST"
echo "[sandbox] Run 'ironclaw skills list' to confirm it appears as trusted."
