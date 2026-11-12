# Confidential Second Opinion

A wallet that can only spend once a private AI jury of three has issued its second opinion.

The owner signs one spending policy. That policy — not a chat prompt — is what bites:
the agent wallet holds real USDC on NEAR Intents (mainnet), but a payment to any
vendor outside the owner-signed whitelist is refused **by the API itself** with
`403 policy_destination_denied`. To open a destination, the wallet first pays for a
deliberation: three private agents review the request, each one commits only a
`result_hash` on-chain (the reasoning stays sealed), and the tally settles the
verdict. Verdict green + owner signature → the vendor goes on the whitelist and the
payment goes through. Everything before that signature is furnace-tested refusal.

**Tracks:** security · privacy · agents
**Chain:** NEAR (mainnet) — USDC native `nep141:1720…"133a1`, Agent Connect rail,
confidential transfers for the jury payment.

## Run the judge

```
npm install
npm run judge
```

~30 seconds, no wallet extension, no live keys: replays real captured receipts
(evidence hashes, no narrative) and shows the guardrail biting before the owner
signs. Every claim is tied to a captured receipt, and the receipts carry their own
disclosed defects — see `fixtures/live-testnet/proposal-76.json`.

## Baseline vs window

This repo reuses prior work. The separation the hackathon requires lives in
[docs/baseline-vs-window.md](docs/baseline-vs-window.md) — prior Delibera
libraries (deliberation engine via [Ensue](https://ensue.network), signing client,
real receipts) are declared baseline with their origin repo; everything demo-side
(judge script, capsule, hash verifier, panel, video) is new-window work and only
new work claims novelty.

Real captured evidence lives in [`fixtures/`](fixtures/) and
[docs/captured-receipts.md](docs/captured-receipts.md).

## Tests

    npm test

21 node:test cases over the pure invariants (no network, no keys): capsule
byte-determinism, totals in atomic integer strings, ensue SSE/JSON envelope
parsing, the tally rule (quorum, not a hardcoded majority), the envelope
unwrap that once produced a wrong verdict, the freshness rule that keeps a
stale result from being settled, and scanner sanity (`.env` never tracked,
capsule never committed). Run first: the suite doubles as doc for the pinned
shapes.

## Demo UI

Static, no framework, no build step:

    open web/demo.html        # narrated run: policy → 403 bite → jurors → payment → capsule
    open web/verify.html      # drag capsule.json + the four fixtures → offline digest re-derivation
    open web/demo-meta.html   # scripts, evidence chain, honest status

All values shown are replayed from committed fixtures — the UI invents nothing.
If you serve `web/` from http (`python3 -m http.server`), the same pages work
unchanged; they never fetch, so plain `open` is enough.

## License

MIT

## Live deliberation loop

Target live loop (testnet-only here, mainnet behind `--i-understand-mainnet`).
Secrets stay in the ORIGINAL Delibera repos:

    cd /Users/manza/Code/hackathon/near-hackathon-26
    NEAR_ENV_FILE=/Users/manza/Code/near-shade-coordination/coordinator-agent/.env.development.local \
    npm run live:testnet -- \
      --dids did:key,<worker dids from worker /health> \
      --labels "Juror 1,Juror 2,Juror 3"

Workers must be running (`near-shade-coordination/worker-agent`,
`npm run dev:worker1` / `dev:worker2` / `dev:worker3`; ports 3001-3003).
Receipt lands in `fixtures/live-<network>/proposal-<id>.json` (dir named by network, so a future mainnet-forced run cannot masquerade as testnet). With no active
run, `--resume-only <id>` re-checks a finished proposal against its receipts.
