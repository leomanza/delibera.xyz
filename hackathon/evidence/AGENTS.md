# AGENTS.md — Confidential Second Opinion

Judge-facing evidence rules come first. Reviewers: flag any violation below as a blocker.

## TypeScript
- Single-purpose .ts modules, named exports only (no default exports).
- Node 20, `tsx` runner, `type: module`. No frameworks: plain fetch, plain fs, ESM imports with explicit `.js` paths.
- Strict types: no `any` on exported public shapes; `any` only at trusted JSON boundaries, commented.
- Node core libs over dependencies. If a change needs a new runtime dep, justify it in the commit message.

## Evidence honesty (the core convention)
- Every claim traces to captured evidence in `fixtures/` or a tracked doc entry.
- Anything not captured live yet is named as such: "omitted until mainnet precedent", never a fabricated liquidation/claim.
- Veredicto fixtures carry network labels: `testnet-capture` until the mainnet precedent exists.
- USDC amounts are atomic strings (6 decimals: '10000' = $0.01). Never floats.
- results of probes print explicit PASS/FAIL/LIVE/NO-LIVE-RESULT states; scripts exit 0 pass / 1 fail / 2 method-surface problem.

## Secrets
- Never commit or echo: `naa_`, `ngt_`, owner keys, `ENSUE_API_KEY`, seed phrases, `.env` contents.
- No key literals in `src/` or `scripts/`. The only key-shaped bytes in the repo live in `assets/test-vectors.json` (official public skill vectors — declared exclusion in `verify-no-key.ts`).
- Owner signing code paths must locate keys via env/keychain at run time only.

## Scripts style
- Scripts `console.log` full sections; `check()` / `pass` / `fail` helpers; terminate with a single explicit machine-readable line (e.g. `ALL VECTORS MATCH`, `NO-KEY CHECK: PASS`, `FIXTURES OK`).
- Offline determinism first: judge/capsule/fixture flows must run without any secret env set.
- Network access allowed for free, read-only probes (RPC view calls). Anything that can move money/gas must be behind an explicit environment + human go-ahead.

## Commit style
- Conventional Commits (`feat`, `fix`, `chore`, `port`, `docs`). No AI attribution lines.
- Each commit keeps the repo in a passing state: `npm run fixtures`, `npm run verify:signing`, `npm run judge` should stay green.
