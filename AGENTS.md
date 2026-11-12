# AGENTS.md — Delibera × Agent Connect

This repo builds Delibera (private multi-agent deliberation) on the NEAR Intents Agent API
("Agent Connect"). Ideas for Agent Connect demos arrive in chat. Before any idea becomes an
experiment doc, it gets audited hard through the gates below. Be aggressive: most ideas are
not actually about Agent Connect, and the audit exists to find out early.

This file is canonical for audits in this repo — keep it in sync with
`.agents/skills/agent-connect-audit/SKILL.md` (from
[NEARBuilders/agent-connect-prototypes](https://github.com/NEARBuilders/agent-connect-prototypes))
if either changes.

## Source of truth

The API's source of truth is the installed skill `.claude/skills/near-intents-agent-api/`
(from [NEAR-Intents-Agent-API/skills](https://github.com/NEAR-Intents-Agent-API/skills)):
`SKILL.md` plus its `references/` — at minimum `concepts.md`, `policy.md`, `grants.md`,
`executions.md`, `architecture.md`, `errors.md`, `status-and-recovery.md`, `signing.md`.

Hard rules:

- Every capability claim must trace to those docs (or to `/openapi.json` / `/llms.txt` of the
  deployment, which are live and authoritative). Never assume the API supports something;
  look it up or mark it as an open blocker question.
- Use the demo base URL (`https://api.demo.agentsonintents.com`) for this project; the hosted
  mainnet (`https://api.agentsonintents.com`) is real funds — prototype guidance uses small
  amounts and dedicated owner accounts.
- Facts are your job (fetch docs, check the API); decisions are the user's.

## Audit protocol

Work the audit in rounds, grilling-style (`.agents/skills/grilling/`):

- Ask numbered questions, one round at a time, each with your recommended answer (`➡️`).
- Wait for answers before the next round. Answers reshape the questions — recompute and continue.
- When a question can be answered by reading the skills docs or the repo's decision record
  (`doc/restart-2026-10.md`), answer it yourself — never ask the user for a fact you can look up.
- Do not write audit files until a verdict is reached and the user confirms it.

## The four gates

An idea only passes if it clears all four. Fail fast and say which gate killed it.

### Gate 1 — Relevance kill-test

Would the idea work just as well with a plain API-key wallet or a custodial account?

- If removing owner-signed policies, revocable per-grant tokens, USD budgets, timelocks,
  approval quorums, confidential (shielded) balances, destination whitelists, or the
  backend/owner/agent key separation does not change the demo, the idea fails here.
- Name the load-bearing capability: which specific Agent Connect mechanism does the idea depend on?
- Is the agent actually the autonomous actor transacting inside signed rules — or a mascot on
  a human-driven UI?
- If a load-bearing capability's support in the API is unclear, that is a blocker to resolve,
  not a hope to wave through.

### Gate 2 — Demo target

Concretely visualize the proof:

- The 1-minute video beat-by-beat: what is on screen at 0:00, 0:15, 0:30, 0:45.
- The minimal demo surface: a small UI (chat + wallet-signature moment + result) or a terminal
  script if no UI is needed. No framework tours.
- The single moment where the human *sees* the guardrail bite.

### Gate 3 — Aha test

State the aha in one sentence a skeptical viewer would repeat afterwards.

- If the aha is generic to "agents + crypto" rather than to *policy-governed* agency, it fails.
- The best ahas demonstrate the rule biting live: budget dropped to zero mid-demo, a grant
  revoked, a freeze, an approval prompt, a confidential balance invisible on-chain.

### Gate 4 — Integration seam

Sketch the real-but-simple, isolated prototype:

- Map the roles: who is the partner (`naa_` API key, backend), who is the owner (wallet
  signature), who is the agent (`ngt_` grant token).
- Name the one artifact: a runnable script, a tiny BFF server, an MCP server exposing
  swap/transfer/quote tools, or a skill for a general agent harness. One artifact, not a platform.
- SDK snippets must compile against the real API; cited constraints come from the skills docs
  (e.g. policy sent complete with `expected_revision`, `APPLIED + provider_policy_synced`,
  `UNCERTAIN` polling, deposit-address-only funding).
- The agent's intelligence is a comment in the snippet; the Agent Connect plumbing is the code.

## Verdicts and routing (this repo)

- **PASS** — the experiment doc lives in `doc/plans/agent-connect-<slug>.md` (house experiment
  format, see the audit SKILL.md) and the build gets logged in `doc/restart-2026-10.md`.
- **FAIL** — append a `## [Killed] <idea> — <reason>` paragraph to `doc/plans/additional.md`.
- **RESHAPE** — agree the reframe with the user, then re-run the gates before writing anything.
- Every audit ends its final response with the ready-to-send reply defined in the audit
  SKILL.md (synopsis + 3–5 capability bullets in the user's voice).

## Project conventions

- **Decision record:** `doc/restart-2026-10.md` — append milestones with dates; never delete history.
- **Secrets:** `naa_…` API key and `ngt_…` grant tokens live in
  `coordinator-agent/.env.development.local` (backend only, never shipped to a browser, never
  printed, never committed). Owner keys live in the macOS keychain under service
  `near-mainnet-<account>` (field `private_key`). Server-side owner signing is legitimate here
  because the demo owner accounts are ours; in a product the owner's browser wallet signs.
- **No commits/pushes without an explicit user request.**
- **Demo:** `cd coordinator-agent && npm run dev` → `http://localhost:3000/second-opinion/demo`.
  Live mode requires the env file; without it the same UI runs mock mode. `/demo/meta` reports
  mode + `/v1/network` health.
- **Amounts are atomic integer strings.** Demo asset: NEAR-native USDC
  `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (6 decimals).
  Confirmed live minimums: verdict $0.01, vendor $0.01.
- **Funding** goes only to a `details.deposit_address`; a `correlation_id` (`op_…`/`intent_…`)
  is a tracking id, never an address. Implicit-agent deposit addresses may not exist on-chain
  or lack token storage — wallets may refuse; create the account + `storage_deposit` first.
- **Signing** uses `ownerSignOwner()` in `src/agent-connect/client.ts` (nep413 for
  destinations/budget-only policy changes, nep366 for anything needing an on-chain tx).
  Verify any change to it against the vectors:
  `npx tsx scripts/verify-agent-connect-signing.ts` (from `coordinator-agent/`) — must print
  "ALL VECTORS MATCH".
- **Idempotency:** stable per-step `Idempotency-Key`s (one key per logical operation); retry
  only with the same key + body. After a proven refusal (`policy_*`, validation, budget),
  a new key may start new work.
- **UNCERTAIN means maybe executed:** poll the original `correlation_id`, never resubmit;
  `NEEDS_REVIEW` means stop and inspect.
- **Policy changes:** always sent complete with `expected_revision`; in force only once the
  policy view shows `APPLIED` and `provider_policy_synced: true`. Destinations/budget-only
  changes need no chain tx (nep413) but do trigger a 10-minute per-agent cooldown.
