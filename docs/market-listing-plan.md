# Plan under review — Option A: sell the verdict service on Agent Market

**Status:** reviewed, then built. The reviewers changed the plan's price and copy,
and the private jury rejected it (0-3). What shipped is listed under
"Outcome" at the bottom of this file.
**Reviewers:** (1) the private jury (3 workers, TEE-attested, on-chain tally),
(2) independent reviewers with different lenses, (3) the author.

---

## The proposal

Put the verdict service on the NEAR Agent Market as a listed agent, so that a
buyer — human or agent — can hire a private jury for a spend decision, and we
deliver the verdict card as Markdown.

### The listing

| Field | Value | Why |
|---|---|---|
| Name | Confidential Second Opinion | the product's own name |
| Handle | `second-opinion` | short, says what it is |
| Tagline | *A private jury for spend decisions — three agents rule, the reasoning stays sealed, the tally settles on NEAR.* | the tagline is what buyers read on Discover |
| Price per hire | $0.05 USDC | 3 NEAR AI inference calls (~$0.005–0.01) + retry buffer + platform fee; the old `SERVICE.md` priced at the same number |
| Delivery SLA | 15 minutes | our real run is 40–90 s; the SLA must survive a retry and a policy cooldown |
| Hosting | Self-hosted | the marketplace does not host agents |
| Deliverable | Markdown verdict card | the marketplace's deliverable format |

### The deliverable (what the buyer actually receives)

```markdown
# Verdict: Approved 2-1 (quorum 2 of 3)

**Proposal:** Pay vendor.near 20 USDC for the Q3 security review…

**Jurors** (reasoning sealed; each committed on-chain before the tally)
| juror | vote | result hash |
|---|---|---|
| Nexus   | Approved | 8db001013402fac4… |
| Sentinel | Approved | dc2b85e68ebbed1e… |
| Pepito   | Rejected | 5f8afaae b20e0e94… |

**Settled on NEAR** — proposal #82 on coordinator.agents-coordinator.testnet
**TEE** — each reply signed by a key bound to Intel TDX hardware (nearai-cloud-verifier)

Advisory only: a private second opinion to inform the decision, not a replacement for it.
```

### The machinery (already written in the baseline)

`coordinator-agent/src/market/market-poller.ts` (214 LOC) — polls
`GET /v1/agents/me/assignments`, calls `/start`, runs the verdict, submits
`{ deliverableMarkdown }`. It already matches the current API.

### What changes

1. Rename the product inside `SERVICE.md` and the poller's copy (Delibera → Confidential Second Opinion).
2. Delete the stale claims from the copy: "no TEE attestation in this build" (now false — 3/3 proofs verified), "settlement is NEAR testnet" (still true — say it precisely), and the old price rationale.
3. The deliverable template carries the evidence (proposal id, explorer link, per-juror hashes, the TEE line) — this is what differentiates us from "give me an AI verdict" tools.
4. The poller must serve the **live** verdict path, not a replay.
5. The listing goes **Live** only after the funded flow is proven (see the gate).

### The gate (do not publish before this)

- The agent holds USDC (it holds 0 today) → a swap of ~$0.05 NEAR → USDC.
- One end-to-end job completes and is accepted, with the escrow released.
- The agent runs continuously enough to honour the SLA.

## The risks we are asking the reviewers about

1. **Reputation damage.** A listing that fails its first job (unfunded agent, the 10-minute `policy_change_throttled` cooldown, a laptop that sleeps) burns the score before the first buyer. The "Proven" chip needs 50 accepted deliveries, 90% acceptance, 10 paying buyers and no lost dispute in 90 days.
2. **No demand signal.** 50 agents are listed; the marketplace is young. Realistic volume inside our window is ~0. Is a listing worth it if it earns nothing in 2.4 days?
3. **Operational burden.** A seller must poll continuously. Our coordinator runs on a laptop. Does that make the listing a liability for the judges' "sustainability" score?
4. **Two rails, one product.** The market escrow pays the buyer; the Agent Connect rail spends. Is that composition clear to a judge, or does it read as two unrelated integrations?
5. **Is this the highest-value use of the last 2.4 days** versus the video quality, the README, and the submission itself?

## What we are NOT doing

- We are not building an oracle network (recruiting other market agents as jurors). Those agents have no persistent identity, no memory and no attestation — using them would erase the three properties that make our jury worth buying.
- We are not routing payments around the marketplace (its terms forbid taking payment outside the platform to avoid the fee).


---

## Outcome (2026-11-12)

**Built, then PAUSED** (agent id `5cb2809a-61cf-4824-bffb-b4753b912788`, category
finance, SLA 1800 s, payable in USDC, price $1.00 per verdict, one
sample-deliverable image).

Paused deliberately: a paused listing is not publicly reachable and cannot be
hired, so nothing can land in a sleeping laptop. A live listing is a public
commitment to serve jobs from a machine that is up — and the only money this
costs is a verdict's inference when a job actually arrives.

Money: nothing. Registration, the listing, the pricing plan and the media upload
are free; the marketplace takes 5% only from a COMPLETED job (no fee on a
refund) and USDC withdrawals have no minimum. The only outlays in the whole
path are (a) a buyer account holding $1.00 for the self-hire, (b) ~$0.05 to
fund the Agent Connect wallet so the rail leg can really purchase, and (c)
~$0.01 of NEAR AI credit per verdict actually run.

What the review changed:

- **Price $0.05 → $1.00.** $0.05 was the ~2% commodity shelf (next to
  `contract-health-auditor` at 7 jobs and `aotrust` at 3). The attested-decision
  shelf is $15–25. Cost is ~$0.01 per verdict, so $1.00 is still 100× cost and
  the 5% fee is $0.05 — the machinery is built for jobs bigger than a cent.
- **The copy had to match the artifact.** The deliverable disclosed every
  juror's reasoning while the listing claimed "sealed". The listing now says
  what is true: sealed from the chain and from the other jurors, disclosed to the
  buyer.
- **Two real bugs in the worker:** the flow timeout (240 s) sat inside the
  measured cold-run duration (295 s), so cold jobs died after `/start`; and the
  coordinator never clears the last tally, so a slow trigger could ship the
  previous verdict. Both fixed.
- **The buyer message and the decline path** were added — the docs say buyers
  expect a message, and declining inside the window is free while shipping late
  or abandoning both cost the record.
- **The rail leg was added**: every verdict sold is purchased internally by the
  policy-bounded wallet, which is what makes the listing the same product as the
  demo rather than a second integration.

What the review rejected:

- **An oracle network** (recruiting other market agents as jurors). Those agents
  have no persistent identity, no memory and no attestation; using them would
  erase the three properties that make the jury worth buying.
- **The plan's own framing as a revenue channel.** With ~650 listings and most
  of them never hired, the listing is a distribution surface and a proof
  artifact. The README says so rather than implying traction.
