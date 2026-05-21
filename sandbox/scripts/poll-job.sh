#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a; source "$SCRIPT_DIR/../.env.sandbox"; set +a
JOB_ID="${1:-$(python3 -c "import json; print(json.load(open('/tmp/last_ironclaw_dispatch.json')).get('job_id',''))" 2>/dev/null)}"
if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "Usage: $0 <job_id>"
  echo "  or run dispatch-task.sh first (saves job_id to /tmp/last_ironclaw_dispatch.json)"
  exit 1
fi
echo "[sandbox] Polling job $JOB_ID ..."
while true; do
  RESP=$(curl -s "http://${HTTP_HOST:-127.0.0.1}:${HTTP_PORT:-8080}/jobs/$JOB_ID" \
    -H "X-Webhook-Secret: ${HTTP_WEBHOOK_SECRET}")
  STATUS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  echo "  $(date +%H:%M:%S) status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo ""
    echo "$RESP"
    break
  fi
  sleep 5
done
