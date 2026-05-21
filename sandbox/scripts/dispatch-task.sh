#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a; source "$SCRIPT_DIR/../.env.sandbox"; set +a
TASK_ID="test-$(date +%s)"
# v0.28.1: auth via 'secret' field in body (deprecated but simple) or X-Hub-Signature-256 (HMAC)
PAYLOAD=$(printf '{"user_id":"coordinator","content":"deliberate task_id:%s proposal_id:prop-1","secret":"%s","metadata":{"taskId":"%s","proposalId":"prop-1"}}' "$TASK_ID" "${HTTP_WEBHOOK_SECRET}" "$TASK_ID")
echo "[sandbox] Dispatching task $TASK_ID to http://${HTTP_HOST:-127.0.0.1}:${HTTP_PORT:-8080}/webhook ..."
echo "[sandbox] Using secret: '${HTTP_WEBHOOK_SECRET}' (should be non-empty)"
RESULT=$(curl -s -X POST "http://${HTTP_HOST:-127.0.0.1}:${HTTP_PORT:-8080}/webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
echo "$RESULT" | tee /tmp/last_ironclaw_dispatch.json
MSG_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message_id','null'))" 2>/dev/null || echo "null")
echo ""
echo "[sandbox] Message ID: $MSG_ID"
echo "[sandbox] Run: bash $(dirname "$0")/poll-job.sh $MSG_ID"
