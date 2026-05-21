#!/bin/bash
# Publishes the runtime SKILL.md to the frontend's public/ so it's served at
# https://delibera.xyz/skill-runtime.md. Idempotent — safe to run every build.
#
# The source is coordinator-agent/src/skills/delibera-worker/SKILL.md — the same
# file rendered into deployed workers' HOME directories by SSH configurator + by
# sandbox/scripts/multi-worker.sh. Publishing a copy means deployed workers AND
# self-deploying agents read content downstream of one source of truth.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$REPO_ROOT/coordinator-agent/src/skills/delibera-worker/SKILL.md"
DEST="$REPO_ROOT/frontend/public/skill-runtime.md"

if [ ! -f "$SRC" ]; then
  echo "ERROR: source not found at $SRC" >&2
  exit 1
fi

cp "$SRC" "$DEST"
echo "[sync-skill-files] Published $SRC → $DEST"

# Sanity: confirm byte-equality after copy
if cmp -s "$SRC" "$DEST"; then
  echo "[sync-skill-files] ✓ byte-equal verified"
else
  echo "[sync-skill-files] ✗ copy diverged from source" >&2
  exit 1
fi
