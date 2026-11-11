# Baseline vs window

Hackathon rule: old own-libraries count as baseline and must be listed. This repo
reuses prior Delibera work for the load-bearing rails and marks everything else
as new window work originating in this repo.

| Component | Status | Origin |
|---|---|---|
| Agent Connect client (`src/agent-connect/client.ts`) | **baseline port** — owner signing (NEP-413/NEP-366), policy API, transfers, idempotency, UNCERTAIN handling | ported from Delibera `coordinator-agent` (github.com/leomanza/near-shade-coordination), signing vectors verified |
| Signing test vectors (`assets/test-vectors.json` + `scripts/verify-signing.ts`) | **baseline port** — official NEAR-Intents-Agent-API skill vectors | NEAR-Intents-Agent-API skills repo |
| Real receipts (`fixtures/*.json`) | **baseline port** — evidence captured 2026-10-19; payment rail receipts are NEAR mainnet, verdict settlement receipt is testnet-captured (honesty-tagged) | Delibera real runs 2026-10-19 |
| Verdict replay module (`src/verdict-fixture.ts`) | **baseline port** (shape) | Delibera demo routes |
| Settlement seam (`src/contract.ts` — `record_worker_submissions`, `coordinator_resume`) | **baseline port** (pattern) — Delibera verdict contract; mainnet deployment verified LIVE by `npm run verify:settlement` (2026-11-08: `coordinator.agents-coordinator.near` answers, proposal id 0 — fresh; testnet id 74). Live settle precedent = gated window work | Delibera coordinator contract |
| Ensue mini-client (`src/ensue.ts`) | **baseline pattern** — hosted Ensue API as the jury coordination backbone | Delibera engine via Ensue (hosted service) |
| Judge script, capsule, no-key test, hash verifier, panel/verify HTML, precedent run, video | **new window work** | this repo |

Anything not on the baseline list above is new in this window. The window cut
date per hackathon rules: 2026-10-19.
