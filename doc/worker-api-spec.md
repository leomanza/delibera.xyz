# Delibera Worker API Specification

This document describes the HTTP API a Delibera worker must expose and the Ensue memory key layout it must write to. Implement this spec to participate in the Delibera swarm with your own codebase.

---

## HTTP Endpoints

### `GET /`

Health check. Must return HTTP 200 with at least:

```json
{
  "status": "healthy",
  "workerDid": "did:key:z6Mk..."
}
```

### `POST /api/task/execute`

Receive a task from the coordinator (LOCAL_MODE / direct HTTP trigger).

**Request body:**

```json
{
  "taskConfig": {
    "type": "vote",
    "parameters": {
      "proposal": "Should the DAO fund X?",
      "proposalId": "42"
    },
    "timeout": 60000
  }
}
```

**Response (immediate, task runs async):**

```json
{
  "message": "Task started",
  "worker": "did:key:z6Mk...",
  "taskType": "vote"
}
```

### `GET /api/task/status`

Returns current task execution state.

```json
{
  "status": "idle | pending | processing | completed | failed"
}
```

---

## Ensue Memory Keys

The coordinator reads results from shared Ensue memory. Your worker MUST write to these keys using your worker DID.

**Prefix:** `coordination/tasks/{workerDid}/`

| Key suffix | Type | Description |
|------------|------|-------------|
| `status` | string | `idle \| pending \| processing \| completed \| failed` |
| `result` | JSON string | WorkerResult (see below) |
| `timestamp` | string | ISO timestamp of completion |
| `error` | string | Error message (if failed) |

**WorkerResult JSON schema:**

```json
{
  "workerId": "did:key:z6Mk...",
  "taskType": "vote",
  "output": {
    "value": 1,
    "vote": "Approved",
    "reasoning": "Because the proposal aligns with the DAO manifesto...",
    "computedAt": "2026-03-20T12:00:00Z"
  },
  "processingTime": 4200
}
```

**How the coordinator triggers your worker (production mode):**

1. Writes task definition to `coordination/config/task_definition` (JSON string of TaskConfig)
2. Sets `coordination/tasks/{workerDid}/status` → `"pending"`
3. Your worker MUST poll Ensue and execute when status = `"pending"`
4. After execution, write `status` = `"completed"` and `result` = WorkerResult JSON

**Ensue polling requirement:**

In production (non-LOCAL_MODE), your worker must poll `coordination/tasks/{workerDid}/status` every 3-5 seconds and trigger execution when it reads `"pending"`. The coordinator does NOT always send HTTP requests.

---

## NEAR Registry

Your worker must register itself on the NEAR registry contract to be discoverable by coordinators.

**Contract:** `registry.agents-coordinator.testnet`
**Method:** `register_worker`
**Args:**

```json
{
  "coordinator_did": "<coordinator DID>",
  "worker_did": "<your did:key:...>",
  "endpoint_url": "<your public HTTPS endpoint>",
  "cvm_id": "local"
}
```

**Gas:** `200000000000000` (200 TGas)
**Deposit:** `100000000000000000000000` yocto (0.1 NEAR)

The reference worker-agent code (`worker-agent/src/workers/task-handler.ts::ensureRegistered()`) handles this automatically on startup.

---

## Ensue Client

Use the shared package for Ensue access:

```typescript
import { createEnsueClient, getWorkerKeys } from '@delibera-xyz/shared';
const client = createEnsueClient(); // reads ENSUE_API_KEY from env
const keys = getWorkerKeys(workerDid);
await client.updateMemory(keys.STATUS, 'completed');
await client.updateMemory(keys.RESULT, JSON.stringify(result));
```

Or implement the Ensue JSON-RPC 2.0 protocol directly:

- **Endpoint:** `https://api.ensue-network.ai/`
- **Auth:** `Authorization: Bearer {ENSUE_API_KEY}`
- **Methods:** `create_memory`, `update_memory`, `get_memory`, `list_keys`
- **Read path:** `structuredContent.results[].value`

**Important:** `update_memory` returns an error if the key doesn't exist yet — fall back to `create_memory` on first write.
