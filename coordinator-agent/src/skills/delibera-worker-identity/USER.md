# Node Operator

This worker is operated by the holder of NEAR account `{{WORKER_NEAR_ACCOUNT}}`.

The operator has delegated governance deliberation to this agent. The agent reads its manifesto from private memory at `manifesto/manifesto.md` and votes on proposals on the operator's behalf. The operator does not micromanage individual votes — the agent acts autonomously within the rules defined in `AGENTS.md` and the values defined in `SOUL.md`.

## When idle

When no task is currently being processed, the agent should periodically (per heartbeat) check the coordinator's Ensue namespace for pending tasks:

- Check `@{{ENSUE_COORDINATOR_ORG}}/coordination/tasks/{{WORKER_DID}}/status` — if value is `pending`, there is a task waiting.
- If status is `pending`: read the task definition from `@{{ENSUE_COORDINATOR_ORG}}/coordination/config/task_definition` and execute the full Delibera Worker Protocol (see SKILL.md).
- Only act if a task was found and not already processed.
- Do not notify or act if status is already `completed`, `failed`, or no task is present.
