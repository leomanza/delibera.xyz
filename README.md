# Confidential Second Opinion

**A wallet that can only buy a second opinion.**

An agent holds real USDC and wants to pay a vendor. It cannot. The agent's spend
is governed by an **owner-signed policy on the NEAR Intents Agent API** — a
destination whitelist, a USD budget, a per-transaction cap. Paying anyone outside
the whitelist is refused by the API itself, before dispatch, with
`403 policy_destination_denied`.

To open a destination, the wallet first buys a **second opinion**: a private jury
of AI agents re-reviews the disputed decision. Each juror commits only a
`result_hash` on-chain — the reasoning stays sealed. The tally settles the verdict
on NEAR. Verdict green + one owner signature → the destination joins the
whitelist → the payment goes through.

Everything before that signature is furnace-tested refusal.

**Tracks:** security · swarms · privacy · agents
**Chain:** NEAR — mainnet USDC (`nep141:17208628…133a1`), Agent Connect rail, on-chain settlement

---

## Try it in 60 seconds

No wallet extension, no keys, no funds, ~30 seconds, no network writes:

```sh
git clone https://github.com/leomanza/near-shade-coordination
cd near-shade-coordination/hackathon/evidence
npm install
npm run judge
```

Expected tail:

```
STEP 7 — El veredicto está en la cadena — verificado por view call
STEP 8 — Prueba sin-llave — el código del rol agente no firma nada
STEP 9 — Cápsula — expediente sin red
RESULT: JUDGE SEQUENCE PASS · NO-KEY CHECK: PASS
```

What you just saw, step by step:

| Step | What it proves | Where it comes from |
|---|---|---|
| 1 | The second opinion is bought: $0.01 confidential transfer to the oracle | captured receipt |
| 2 | Three jurors deliberate; only `result_hash` commitments travel, tally 3–0 | captured proposal #74 |
| 3 | **The guardrail bites**: `403 policy_destination_denied`, issued by the provider before dispatch | captured refusal |
| 4 | Byte-level integrity of the evidence, honestly scoped | recomputed digests |
| 5 | The ratification is real: NEP-413, tag 2147484061, sha256 | byte-verified against official vectors |
| 6 | After ratification the same payment goes through, with a receipt | captured receipt |
| 7 | The verdict is on-chain, read back with a view call | chain state |
| 8 | The agent-role code carries no owner key material | repo-wide scan |
| 9 | The capsule re-derives every digest offline | `npm run verify:capsule` |

Also:

```sh
npm test                      # 18 invariant tests — offline, no keys
npm run verify:capsule        # re-derive the capsule digests
open web/demo.html            # narrated run: policy → 403 bite → jurors → payment → capsule
open web/verify.html          # drag capsule.json + the 4 fixtures → digests re-derived in-browser
```

The live path (real jurors, real chain writes) needs secrets and runs against
testnet by default — see [Live run](#live-run-real-jurors-real-chain).

---

## What's new in this window

The hackathon window opened **2026-10-19** (the announcement). Everything before
that is baseline and is listed below; the baseline tag makes the boundary
machine-checkable:

```sh
git diff pre-hackathon..hackathon            # exactly the window's work
git log --oneline pre-hackathon..hackathon
```

| New in this window | Where |
|---|---|
| **The Agent Connect policy rail** — owner-signed policy, destination whitelist, USD budget, per-transaction cap, `403` refusal, `UNCERTAIN` polling | `coordinator-agent/src/agent-connect/client.ts` |
| **The live session UI** — every step renders its API receipt; the owner signature is shown, not hidden; the 403 shows its full anatomy; the last screen is a copyable evidence receipt | `coordinator-agent/src/agent-connect/demo-page.ts`, `demo-routes.ts` |
| **The verdict oracle seam** — proposal in → verdict card out, settlement untouched | `coordinator-agent/src/agent-connect/verdict-oracle.ts` |
| **The evidence harness** — judge sequence, capsule (`cso-capsule/1`), offline digest verifier, no-key scanner, 18 invariant tests | `hackathon/evidence/` |
| **A live end-to-end precedent on testnet** — proposal **#80**: three real jurors voted independently and **one dissented** (Approved 2-1, quorum 2/3), `record_worker_submissions` + `coordinator_resume` settled on-chain, and each juror's `sha256(result)` still equals the contract's `result_hash` | `hackathon/evidence/fixtures/live-testnet/proposal-80.json` |
| **TEE proof for the jurors' reasoning** — the NEAR AI Cloud signature of each juror's reply is verified with **NEAR's own official verifier**, and the signing key is shown to be bound to genuine Intel TDX hardware | `npm run verify:tee` in `hackathon/evidence` |
| **Jury size as a parameter** — `--jurors N --quorum K`; the contract already stored `expected_worker_count`/`quorum` | `hackathon/evidence/scripts/run-live.ts` |

**Baseline** (pre-window, reused and disclosed per the rules — own libraries
count as baseline, they are listed here rather than claimed as new):

| Baseline piece | Origin |
|---|---|
| Multi-agent deliberation engine, coordinator, worker agents | this repo, pre-window |
| Ensue Memory Network coordination | this repo, pre-window |
| Rust coordinator contract (`promise_yield` create/resume) | `coordinator-contract/`, pre-window |
| Next.js frontend, dashboard, onboarding | `frontend/`, pre-window |
| The Stellar/x402 paid-deliberation path | `coordinator-agent/src/x402/`, `x402-client/` — pre-window, **not** the path this project submits |
| Official NEAR Intents Agent API signing vectors | `hackathon/evidence/assets/test-vectors.json` |

The full baseline manifest: [docs/baseline-vs-window.md](docs/baseline-vs-window.md).
The prior product's README is preserved verbatim at
[docs/baseline-delibera-readme.md](docs/baseline-delibera-readme.md).

---

## How it works

```
 owner signs policy            3 private jurors                  tally settles        owner ratifies
 (NEP-413, once)   ──────►  reason independently,      ──────►  on NEAR       ──────►  destination joins
                          commit result_hash only             coordinator.        the whitelist
                          (reasoning stays sealed)             agents-coordinator   → payment goes
                                                                 .testnet            through
                                                                        
 meanwhile the agent tries to pay the vendor:
   POST /v1/agents/{id}/transfer  →  403 policy_destination_denied  (before dispatch)
```

Three things make this different from "a wallet with a spending limit":

1. **The rule is enforced by someone else.** The refusal comes from the Agent
   Connect API, not from a contract we wrote — the policy is owner-signed and
   applied off-chain by the provider, with `provider_policy_synced` proving the
   provider is enforcing the revision we think it is.
2. **The unlock is a verdict, not a key.** A destination only joins the whitelist
   after a private jury's tally settles on-chain and the owner signs once. The
   reasoning is sealed: only `sha256(result)` reaches the chain.
3. **The evidence is byte-linked.** The capsule pins every fixture by sha256 and
   the whole thing re-derives offline, in a browser, with no keys.

**Privacy model (honest version):** reasoning is sealed by *architecture* — it
lives off-chain, only commitments settle on-chain. The jurors' inference runs on
NEAR AI Cloud, which returns a TEE attestation and a response signature per
call; those are carried with the vote so a buyer can verify which hardware
produced the reasoning. We do **not** claim the reasoning itself is confidential
from the compute provider, and we do not claim cryptographic privacy of the
sealed text.

---

## Live run (real jurors, real chain)

Testnet by default. Mainnet requires an explicit flag and the owner's key.

```sh
cd near-shade-coordination/hackathon/evidence
NEAR_ENV_FILE=/path/to/coordinator.env \
npm run live:testnet -- --dids did:key,<worker1>,did:key,<worker2>,did:key,<worker3> \
  --labels "Juror 1,Juror 2,Juror 3"
```

Jury size is a flag: `--jurors 5 --quorum 3` runs a five-juror panel.
`--resume-only <id>` finishes a proposal opened by an earlier run. The receipt
lands in `hackathon/evidence/fixtures/live-testnet/proposal-<id>.json`.

What a live run proves, and what it does not:

- **Proves:** real jurors voted independently (no hardcoded tallies); the
  coordinator contract accepted the submissions and finalized; each juror's
  `sha256(result)` equals the `result_hash` the contract committed.
- **Does not yet prove:** a mainnet settlement (the mainnet coordinator account
  is not ours to sign for — that receipt is honestly marked "omitted until
  live", not faked).

### Known issue in precedent #76 (disclosed, not hidden)

The earlier precedent #76 settled a tally that is **wrong** (`Rejected 0-3`). The
harness parsed the memory *envelope* instead of the result document, so every
juror looked like "no vote" and was counted as a rejection; re-reading the same
live bytes gives **Approved 3-0**. The contract only accepts a resume from
`WorkersCompleted`, so #76 cannot be amended — hence the fresh **#80** above,
which is the reference run.

The bug is fixed (`extractResultJson()` in `hackathon/evidence/scripts/run-live.ts`)
and pinned by tests, and the #76 receipt carries the whole story in its
`knownIssue` note. We would rather show the judge a disclosed bug than a tidy
lie.

One more class of bug was found and fixed the same way: the run used to accept
*any* stored result as "the workers finished", so it could settle on the
*previous* round's votes while the workers were still voting. The wait now
requires a result produced **after** the trigger (`isFreshResult()`), and the
run refuses to trigger while a juror is still mid-vote.

### The live policy rail (the guardrail biting, for real)

The refusal has to come from the API — a replay cannot prove it. The rail runs
it live and writes a receipt with the provider's own error body:

```sh
cd hackathon/evidence
NEAR_ENV_FILE=/path/to/coordinator.env npm run live:rail
```

It reads the agent's live policy, then has the agent pay a destination that is
**not** on the owner-signed whitelist. The API must refuse it before dispatch
with `403 policy_destination_denied`. With `--ratify <address>` it also runs
the unlock leg: the owner signs ONE policy update (NEP-413, no chain tx), the
policy goes `APPLIED` + `provider_policy_synced`, and the same transfer then
goes through. If the grant in the environment is dead it mints a new one with
the owner's signature (the token is never stored — only its sha256 commitment).

Exit codes: `0` the rail ran and the bite was refused, `1` the guardrail did
**not** hold, `2` the method surface is unavailable (no key, retired key, no
agent) — the offline judge stays green in that case.

> **Status: waiting on a partner key.** The key in our environment was retired
> by the provider (`api_key_retired` — "keys moved to the partner portal").
> A new key from <https://partners.demo.agentsonintents.com> plus the owner key
> in the keychain is all this needs. The API itself is healthy: mainnet,
> `operational`, `outlayer.near` as the provider contract.

### Re-check the whole precedent yourself

```sh
cd hackathon/evidence
npm run verify:live      # chain + receipt + live memory + TEE proofs, one command
```

```
[1] CHAIN
  OK   — state Finalized
  OK   — 3 worker_submissions commitments match the receipt
  OK   — on-chain verdict Approved 2-1 matches the receipt
  OK   — sha256(aggregated_result) equals the committed resultHash
[2] LIVE MEMORY (the bytes the commitments were made over)
  OK   — did:key:z6MkuLv3ysAUfL… sha256(live result) == the committed resultHash
  OK   —        TEE proof: the wire bytes re-derive the signed hashes and the signature verifies (Approved)
  ...
PRECEDENT VERIFICATION PASS — 0 check(s) failed
```

---

## TEE proof — the reasoning came from real hardware

```sh
cd hackathon/evidence
npm run verify:tee
```

```
did:key:z6MkuLv3ysAUfL…  model deepseek/deepseek-v3.2
   chat signature valid : YES   (key 0xb98a789cdc…)
   Intel TDX quote      : VERIFIED · report_data binds the signing key
   GPU verdict (server) : PASS · tcb UpToDate · provider chutes
...
TEE TEE PROOF VERIFIED — 3/3 signatures valid, 3/3 keys bound to Intel TDX hardware
```

NEAR AI Cloud signs the exact request/response bytes with the key of the TEE
that served the model. We check that with **NEAR's own official verifier**
(`nearai-cloud-verifier`): the ECDSA signature is verified over the signed
payload, and a fresh Intel TDX quote is fetched for that signing key and
verified locally — its `report_data` binds the key *and* a fresh nonce, so the
quote cannot be replayed against another key or a stale request. The
attestation fetch is non-billable and needs no API key, so the check costs
nothing and exposes no secret.

What we do **not** claim: the NVIDIA GPU attestation is *reported* by the API
(`gpu_verdict: PASS`, `tcb_status: UpToDate`, certificates attached) rather than
re-verified locally, because the alpha verifier expects an older payload shape
than the API returns today. And the request/response bytes of the #76 run were
not retained, so the hash-level comparison cannot be redone for that run — the
signature can, and it binds the hashes to the TEE key. The capture path in
`worker-agent` now keeps the bytes, the signed text verbatim, and the proof
**inside** the sealed result, so the on-chain commitment binds the TEE proof to
the reasoning.

---

## Evidence

| Artifact | What it is |
|---|---|
| `hackathon/evidence/fixtures/policy.json` | owner-signed policy, revision 4, `APPLIED` + `provider_policy_synced: true` |
| `hackathon/evidence/fixtures/proposal-74.json` | verdict #74, 3–0, per-juror `result_hash` (testnet-captured) |
| `hackathon/evidence/fixtures/receipt-approved.json` | $0.01 USDC `intents_transfer`, `UNCERTAIN` → `SUCCESS` |
| `hackathon/evidence/fixtures/receipt-denied.json` | the `403 policy_destination_denied` — the guardrail bite |
| `hackathon/evidence/fixtures/live-testnet/proposal-76.json` | live precedent #76 — real jurors, on-chain settlement, receipts |
| `hackathon/evidence/docs/captured-receipts.md` | the evidence log, including what is *not* yet proven |

House rules for this repo (evidence honesty first, never-echo of secrets, commit
style) are in [AGENTS.md](AGENTS.md).

---

## Honest status

- The policy rail, the 403 refusal and the $0.01 payment are **captured
  receipts** from real runs, replayed by the judge sequence — not a live
  re-execution on demand. The live precedent (#76) covers the jury and the
  on-chain settlement.
- The vendor refusal is **not repeatable on demand**: the capture's daily budget
  is spent, so the refusal receipt is the evidence.
- Jurors are AI agents with their own persistent identities and memories; the
  sealed-reasoning commitment is independently checkable against the memory
  store that produced it (`npm run verify:ensue74` → 3/3 ALL MATCH).
- The `x402`/Stellar path in this repo is pre-window baseline and **not** part of
  what is submitted; the submitted payment rail is the NEAR-native Agent Connect
  API.

## License

MIT. The prior product's documentation is preserved under
[docs/baseline-delibera-readme.md](docs/baseline-delibera-readme.md).
