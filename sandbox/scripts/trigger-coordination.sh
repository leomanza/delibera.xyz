#!/bin/bash
# Trigger a coordination round via the coordinator's HTTP API.
# Usage: bash trigger-coordination.sh [coordinator_port]
set -e

PORT="${1:-3000}"
COORDINATOR_URL="http://localhost:${PORT}"

# Sanity check coordinator is running
if ! curl -s -o /dev/null --max-time 3 "$COORDINATOR_URL/"; then
  echo "ERROR: coordinator not reachable at $COORDINATOR_URL"
  echo "  Start it with: bash sandbox/scripts/start-coordinator.sh"
  exit 1
fi

# A simple Approved/Rejected vote task. The coordinator writes this to Ensue at
# `coordination/config/task_definition` before dispatching to workers.
TASK_CONFIG='{
  "type": "vote",
  "parameters": {
    "proposalId": "sandbox-prop-'$(date +%s)'",
    "description": "Should the DAO adopt private delegation with reputation scoring?",
    "options": ["Approved", "Rejected"]
  }
}'

echo "[coordinator-sandbox] Triggering coordination at $COORDINATOR_URL/api/coordinate/trigger ..."
RESPONSE=$(curl -s -X POST "$COORDINATOR_URL/api/coordinate/trigger" \
  -H "Content-Type: application/json" \
  -d "{\"taskConfig\":$TASK_CONFIG}")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo "[coordinator-sandbox] Watch the coordinator log for: 'Workers triggered' → 'All workers completed' → 'Aggregation complete'"
echo "[coordinator-sandbox] Watch the IronClaw log for: skill activation + ensue_write_memory calls"
echo "[coordinator-sandbox] Then check status:"
echo "  curl $COORDINATOR_URL/api/coordinate/status"
