#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.sandbox"
[ -f "$ENV_FILE" ] && { set -a; source "$ENV_FILE"; set +a; }

IRONCLAW_HOME="${IRONCLAW_HOME:-$HOME/.ironclaw}"
SKILLS_SRC="$REPO_ROOT/coordinator-agent/src/skills"
SKILL_DEST="$IRONCLAW_HOME/skills/delibera-worker"

# Sanity check required env vars
for v in WORKER_DID WORKER_NEAR_ACCOUNT ENSUE_COORDINATOR_ORG; do
  if [ -z "${!v}" ]; then
    echo "ERROR: $v is empty. Set it in .env.sandbox before running this script."
    exit 1
  fi
done

mkdir -p "$SKILL_DEST"

# Compute the task-definition key path. If the worker shares an org with the
# coordinator (sandbox / same-key setup), Ensue rejects the @org/ prefix:
#   "Cannot use @org prefix for your own organization. Use the key name directly."
# So for the sandbox we always use the direct key path.
# For production cross-org, the SSH configurator will compute this with the
# coordinator's actual org name.
TASK_DEFINITION_KEY="coordination/config/task_definition"
if [ -n "${ENSUE_WORKER_ORG:-}" ] && [ "$ENSUE_WORKER_ORG" != "$ENSUE_COORDINATOR_ORG" ]; then
  TASK_DEFINITION_KEY="@${ENSUE_COORDINATOR_ORG}/coordination/config/task_definition"
fi

# Render SKILL.md — substitute ${VAR} placeholders (IronClaw does NOT do this itself)
sed \
  -e "s|\${WORKER_DID}|$WORKER_DID|g" \
  -e "s|\${WORKER_NEAR_ACCOUNT}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|\${ENSUE_COORDINATOR_ORG}|$ENSUE_COORDINATOR_ORG|g" \
  -e "s|\${TASK_DEFINITION_KEY}|$TASK_DEFINITION_KEY|g" \
  "$SKILLS_SRC/delibera-worker/SKILL.md" > "$SKILL_DEST/SKILL.md"

# Render identity files into the workspace root (~/.ironclaw/)
# AGENTS.md and SOUL.md are static, no substitution needed
cp "$SKILLS_SRC/delibera-worker-identity/AGENTS.md" "$IRONCLAW_HOME/AGENTS.md"
cp "$SKILLS_SRC/delibera-worker-identity/SOUL.md" "$IRONCLAW_HOME/SOUL.md"

# IDENTITY.md uses {{PLACEHOLDER}} syntax (different from SKILL.md's ${VAR})
sed \
  -e "s|{{WORKER_DID}}|$WORKER_DID|g" \
  -e "s|{{WORKER_NEAR_ACCOUNT}}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|{{COORDINATOR_CONTRACT}}|${COORDINATOR_CONTRACT:-registry.agents-coordinator.testnet}|g" \
  "$SKILLS_SRC/delibera-worker-identity/IDENTITY.md" > "$IRONCLAW_HOME/IDENTITY.md"

sed \
  -e "s|{{WORKER_DID}}|$WORKER_DID|g" \
  -e "s|{{WORKER_NEAR_ACCOUNT}}|$WORKER_NEAR_ACCOUNT|g" \
  -e "s|{{ENSUE_COORDINATOR_ORG}}|$ENSUE_COORDINATOR_ORG|g" \
  "$SKILLS_SRC/delibera-worker-identity/USER.md" > "$IRONCLAW_HOME/USER.md"

echo "[sandbox] Synced files:"
echo "  $SKILL_DEST/SKILL.md       (WORKER_DID=$WORKER_DID)"
echo "  $IRONCLAW_HOME/AGENTS.md"
echo "  $IRONCLAW_HOME/SOUL.md"
echo "  $IRONCLAW_HOME/IDENTITY.md (WORKER_DID=$WORKER_DID)"
echo "  $IRONCLAW_HOME/USER.md     (WORKER_DID=$WORKER_DID)"
echo ""
echo "[sandbox] Run 'ironclaw skills list' to confirm. Restart IronClaw to pick up identity file changes."
