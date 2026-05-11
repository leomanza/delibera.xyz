#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a; source "$SCRIPT_DIR/../.env.sandbox"; set +a
TASK_ID="test-$(date +%s)"
PAYLOAD=$(printf '{"user_id":"coordinator","message":"deliberate task_id:%s proposal_id:prop-1","metadata":{"taskId":"%s","proposalId":"prop-1"}}' "$TASK_ID" "$TASK_ID")
echo "[sandbox] Dispatching task $TASK_ID to http://${HTTP_HOST:-127.0.0.1}:${HTTP_PORT:-8080}/webhook ..."
RESULT=$(curl -s -X POST "http://${HTTP_HOST:-127.0.0.1}:${HTTP_PORT:-8080}/webhook" \
  -H "X-Webhook-Secret: ${HTTP_WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
echo "$RESULT" | tee /tmp/last_ironclaw_dispatch.json
JOB_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_id','null'))" 2>/dev/null || echo "null")
echo ""
echo "[sandbox] Job ID: $JOB_ID"
echo "[sandbox] Run: bash $(dirname "$0")/poll-job.sh $JOB_ID"
