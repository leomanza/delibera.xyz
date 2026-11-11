# Delibera — Restart Decision, 2026-10-03

## The frame (from problem framing, 2026-10-03)

1. **The job:** get a verifiable collective verdict on whether a proposal fits a
   community's own rules, without exposing how any individual decider reasoned.
2. **Job-holder:** in the demo, a DAO member submitting a proposal judged by
   independent AI voters (and, in the x402 variant, an external AI agent buying the
   verdict). On NEAR today, the human-DAO version is thin; the job survives in
   agent-native form — agents adjudicating work (bid evaluation, dispute resolution,
   proposal screening) on Agent Market, and IronClaw/NEAR AI operators whose agents
   must reason without leaking inputs.
3. **IS / IS NOT.** IS: a proven primitive (N private AI voters → aggregate-only
   on-chain tally), open-source code, two live testnet contracts, three-ecosystem
   receipts. IS NOT: "anyone can deploy their own agents through the platform"
   (site is 404), "zero API keys, zero humans in the loop" (founder-operated
   coordinator + Ensue/NEAR AI keys), "autonomous inside Phala TEEs" (production
   TEE path rode Shade, deprecated; the demo ran LOCAL_MODE), and not a
   revenue-earning oracle (the demo buyer wallet was project-funded).
4. **Stack vs. today's NEAR:** still runs — NEAR AI private inference (the voter
   core), IronClaw as current runtime, yield/resume contracts, Ensue (external,
   alive). Deprecated — Shade Agent Framework (production coordinator path).
   Dead with the site — skill manifests, /buy flow, x402 web demo, dashboard:
   every onboarding and distribution surface.
5. **Distribution:** possible only agent-native — Agent Market listing + NEARLegion
   narrative + X amplification once something is live. The February model
   (hosted platform) is dead; no new chain needed.
6. **Kill assumption:** that anyone will pay — money or effort — for a private,
   multi-agent deliberation verdict instead of a free single-model answer or a
   plain public vote.

## The 30-day path

**Chosen:** make one NEAR-native flow work again and list it where NEAR users
already are (Agent Market).

**The flow:** a paid deliberation verdict. Buyer posts a proposal via the market;
three workers deliberate on NEAR AI private inference via Ensue; coordinator
tallies and settles the aggregate on the existing testnet contract (LOCAL_MODE);
buyer receives verdict + per-worker reasoning + NEAR tx hash. Market escrow
handles payment — no bespoke payment rail.

**Success metric (30 days):** ≥1 paid verdict purchased on Agent Market by someone
who is not the founder. Gate: flow must run end-to-end (fresh proposal finalized
with tx hash) before listing. If zero paid verdicts after 30 days listed, the kill
assumption fires — stop.

**Non-goals (scoped to these 30 days):**
- Restoring delibera.xyz **as the February platform** (dashboard, /buy,
  manifests, x402 web demo, second storefront) — that was the February
  distribution model and it stays dead for 30 days.
- …BUT see the frame challenge below: a **minimal one-page landing** at
  delibera.xyz is ALLOWED as a task-3 supporting artifact (credibility +
  evidence for the announcement), capped at half a day. Full relaunch remains
  a non-goal. Revisit AFTER validation: if paid demand exists, the site grows
  back as marketing/docs home — as a consequence of demand, not a prerequisite.
- TEE/Phala production mode or any Shade replacement
- New chains or chain ports (no Stellar x402, no Vela)
- Zama FHE, Flow VRF, Storacha/Lit/Filecoin tiers
- Permissionless worker onboarding / registry flow — run all 3 workers in-house
- Mainnet

**First three tasks, in order:**
1. Revive the local flow: refresh Ensue + NEAR AI credentials, run coordinator
   (LOCAL_MODE) + 3 workers, drive one proposal from trigger to finalized tally on
   `coordinator.agents-coordinator.testnet`. Done = fresh on-chain tx hash.
2. Package one callable service: thin adapter endpoint (proposal in → verdict +
   reasoning + tx hash out) on a stable host, fixed price, one-page service
   description.
3. List on Agent Market: register the agent, publish the service, set the price;
   announce in NEARLegion + one X post with a recorded run as evidence.

---

## Human-DAO version: compete or collaborate? (added 2026-10-03)

**Verdict: collaborate. Competing is both unwinnable and unwanted.**

- *Compete* means agents replace human votes. No treasury or community will cede
  decision rights to three LLMs — legitimacy is the whole point of a DAO — and the
  frame already shows the human-DAO job on NEAR is thin, so there is nothing to win.
- *Collaborate* means the verdict is an **advisory layer, never a decision layer**;
  humans keep the vote. Three concrete collaboration slots:
  1. **Pre-screening** — a private multi-agent verdict filters proposals before
     humans spend attention (spam/fraud/manifesto-fit check).
  2. **Delegate augmentation** — a worker agent carrying a member's values
     (the repo's persistent-identity concept) advises that member on each vote.
  3. **Treasury advisory** — a verdict attached to a multisig payment approval
     (the Trezu/Sputnik flow below).
- The one thing the flow still *competes* with is the free single-LLM summary —
  that is the kill assumption restated. Collaboration doesn't remove the demand
  test; it sharpens the buyer: a delegate or team that wants a private, attested
  second opinion, not a DAO that wants to be replaced.
- NEAR-concrete venue: **House of Stake** is the only live human-governance arena
  on NEAR. A public advisory verdict on one real HoS proposal is the collaboration
  demo — and ready-made content for NEARLegion and X.

## Alliance priorities in the NEAR ecosystem (added 2026-10-03)

Rule: push only what carries buyers or a real proposal inside the 30 days; defer
everything that only matters after demand exists.

**Push now (inside the 30 days):**
- **Agent Market** — distribution + escrow + payments in one; already task 3.
  No bespoke payment rail needed.
- **NEARLegion** — 3.3K+ members, on-narrative (privacy + IronClaw), runs paid
  content missions and events. Costs only time; supplies awareness and candidate
  first users for the listing.
- **IronClaw / ironhub** — the runtime NEAR AI actively promotes; the repo already
  has ironclaw-integration work and the June `delibera-council` skill. Packaging
  the worker as an IronClaw skill in the signed catalog is both the runtime fix
  (replaces the dead custom/Shade path) and a second listing where IronClaw users
  already are.
- **MultiAgency / NearBuilders cluster** — multiagency.ai is the NEAR-native
  "open books" agency layer: client engagements whose Billings are Trezu DAO
  transfer proposals, wired into NEARN bounties and the NearBuilders directory
  that NEARLegion sources its paid roster from. Two cheap moves this month: get
  Delibera listed in the NearBuilders directory (85+ builders; that's how teams
  paying for work find you) and register interest for "Launch your own Agency."
  Its Billing proposals are also the first live, real-cadence treasury-advisory
  target (collaboration slot #3) — this cluster is where the Trezu play actually
  happens.

**Cultivate after the first paid verdict:**
- **Trezu** (NEAR-DevHub) — multisig treasury on Sputnik contracts with a
  confidential-treasury offering; the highest-density "should we approve this
  spend" job on NEAR, and its privacy narrative matches. Approach with a working
  advisory-verdict demo on a spend approval — not before the flow runs.
- **House of Stake** — venue for the public advisory-verdict demo above, not a
  cold partnership.
- **Outlayer** — TEE custody; relevant only to a later "verdict triggers an
  economic action" phase. Keep warm, don't push.

**Don't push:**
- **PingPay** — vestigial as Delibera's payment rail; Agent Market escrow
  replaces it. (The PingPay team is alive inside the MultiAgency cluster —
  onramp.pingpay.io is a MultiAgency project — so the relationship stays warm,
  but don't reopen the rail question inside the 30 days.)
- **NEAR Intents** — comes free inside Agent Market and Trezu; no separate
  alliance needed.

---

## Execution runbook (added 2026-10-03)

Strictly sequential. Each task is a fresh session with the prompt below; do not
start task N+1 until task N's done-criterion is in hand. The gate is real:
distribution only happens if the flow runs.

### Prompt 1 — revive the local flow

```
You are reviving Delibera's local voting flow (task 1 of doc/restart-2026-10.md).

Read first:
- /Users/manza/Code/near-shade-coordination/doc/restart-2026-10.md
- /Users/manza/Code/near-shade-coordination/doc/reference/CLAUDE.md
  (esp. "Running Locally", "Key Environment Variables", Common Gotchas #1, #19-21)

Do:
1. Verify credentials in coordinator-agent/.env.development.local and
   worker-agent/.env.worker{1,2,3}.local: ENSUE_API_KEY/ENSUE_TOKEN, NEAR_API_KEY.
   Rotate the Ensue key (a prior key was exposed in a legacy hosted chat). Test
   NEAR AI with one curl chat completion before starting any service.
2. cd shared && npm install && npm run build, then ./run-dev.sh (skip frontend).
3. Trigger one proposal:
   curl -X POST http://localhost:3000/api/coordinate/trigger \
     -H 'Content-Type: application/json' \
     -d '{"taskConfig":{"type":"vote","parameters":{"proposal":"Fund a developer education program","voting_config":{"min_workers":3,"quorum":3}}}}'
4. Poll /api/coordinate/status until the tally lands and the contract resumes;
   capture proposal id + NEAR testnet tx hash + the 3 worker reasonings.

Rules: LOCAL_MODE only; no Phala/Shade; no Storacha/Lit/Zama/Flow; no new chains;
no frontend work; never run git commit/push — hand me the commands. The pipeline
must finish inside ~100s (200-block yield timeout, gotcha #21); if voting is too
slow, drop to 2 workers (min_workers=2, quorum=2) before debugging anything else.
If Ensue or NEAR AI credentials are dead, stop and report which one.

Done = fresh finalized proposal with tx hash on coordinator.agents-coordinator.testnet.
Report: tx hash, proposal id, timings, and everything you had to fix.
```

### Prompt 2 — package the service

```
You are packaging Delibera's revived flow as one callable paid-verdict service
(task 2 of doc/restart-2026-10.md). Task 1 is done: flow finalizes on
coordinator.agents-coordinator.testnet (tx <HASH>, proposal <N>).

Read: doc/restart-2026-10.md, doc/reference/CLAUDE.md § The Voting Flow
(Permissionless, Model A), coordinator-agent/src/routes/coordinate.ts.

Do:
1. Add a thin additive adapter (new module; do NOT modify the voting flow):
   request {proposal} in → trigger + poll → out {verdict, approved, rejected,
   perWorkerReasoning[], nearTxHash, proposalId}.
2. Make it reachable. First fetch https://market.near.ai/skill/SKILL.md and
   https://market-legacy.near.ai/skill.md to see which agent interface is live,
   then pick: (a) stable host (cheap VPS or this machine + cloudflared tunnel)
   for inbound calls, or (b) outbound market-poller that watches for jobs and
   runs the flow locally (no inbound hosting needed).
3. Write the one-page service description: what the buyer gets (verdict + 3
   private reasonings + NEAR tx hash), delivery time (<5 min), limits (testnet
   settlement, advisory only, no TEE attestation), price — founder sets; must
   exceed ~$0.05 cost, cheap enough to be an impulse buy (suggest $1-2 USDC
   equivalent).

Rules: no new chains, no TEE/Phala, no site/frontend, no git commits — hand me
the commands. Keep the adapter purely additive, like the x402 router was.

Done = from a clean shell, one request produces a verdict JSON with a real tx
hash, twice in a row. Report: endpoint/poller shape, hosting choice, description
draft.
```

### Prompt 3 — list and announce

```
You are listing Delibera's verdict service where NEAR users already are (task 3
of doc/restart-2026-10.md). Tasks 1-2 done: <endpoint/poller>, price <P>,
description at <path>.

Do:
1. Read the live onboarding (https://market.near.ai/skill/SKILL.md, /llms.txt;
   legacy fallback: https://market-legacy.near.ai/skill.md) and register the
   Delibera agent + publish the verdict service at the set price, on whichever
   market version actually accepts registrations today.
2. Record one full run (screen capture): brief → payment → deliberation →
   verdict + tx hash. This is the evidence asset.
3. Announce: NEARLegion community channel (t.me/nearlegionbot) + one X post with
   the recording. Frame it as advisory — "a private second opinion before you
   vote or approve" — never as replacing votes.

Rules: no git commits; promise nothing beyond what works today (testnet,
advisory, no TEE). If v2 registration is broken mid-migration, list on legacy
and note it.

Done = service visible in the market directory + announcement links. Day 0 of
the 30-day metric starts now: ≥1 paid verdict from a non-founder buyer by
<date+30>.
```

---

## Warm inbound: Elliot (NEAR growth team), 2026-10-02

Elliot Braem (NEAR growth) reached out: "What have you been working on? And what
topics have you been gravitating towards?"

**Read:** the highest-leverage opening of the month — more than any cold
listing. Growth's job is finding ecosystem stories that prove NEAR's current
thesis (private, verifiable AI; agentic commerce; "NEAR is AI money"), and the
restart is exactly such a story. Elliot can carry it to the NEAR AI / Agent
Market team, the IronClaw hub, NEARLegion amplification, and the
MultiAgency/NearBuilders cluster — and he can answer the only question that
matters: whether anyone at NEAR itself would be a first buyer (House of Stake
advisory verdicts).

**Reply strategy:** answer his actual questions, briefly and honestly. Lead with
the one live thing (the 30-day restart and its demand test), not the February
vision. Name the alignment with the thesis his team is amplifying. One concrete
ask + one offer — never a laundry list.

**Draft reply (v8, 2026-10-05 — founder's edit + "always privacy-preserving"
framing; FINAL, ready to paste):**

> hey Elliot! good to hear from you. sorry for the slow reply, the week got
> away from me.
>
> I'm revamping delibera, got it running again on the current NEAR stack and
> getting it onto the Agent Market (market.near.ai) these days. my focus has
> always been privacy-preserving stuff, and honestly the last few months I've
> been going around the same theme with a few different ideas — private
> multi-agent deliberation, verifiable results, agents deciding without leaking
> their reasoning.
>
> also getting back into ecosystem stuff, contributing to nearbuilders.org
> again.
>
> anyway I just sent you a calendar invite for tomorrow, hope it works

**Held for the meet (dropped from the message, keep as talking points):**
the 30-day paid-demand test + $0.05 pricing logic; the receipts (#62–#64
finalized on testnet, verifiable via RPC); the ask (who owns Agent Market /
IronClaw hub — intro); the offer (public advisory verdict on a real House of
Stake proposal as a growth artifact); the MultiAgency/Trezu treasury-advisory
angle.

**Status precision (keep honest if Elliot checks):** the flow RUNS (verdicts
settle on testnet); the market presence is REGISTERED (handle `delibera` in the
directory) but NOT yet listed/working — poller built and selftested, daemon +
published service + announcement are task 3. Say "getting it onto the market",
not "it's live on the market", until task 3 lands.

**Sequencing:** SENT 2026-10-05 → led to the Oct-13 meet and the cohort
opportunity (see "Agent Connect cohort" above).

**Elliot follow-up (v9, 2026-10-16 — answering his morning check-in; running
late + the idea in a few words):**

> hey Elliot! going a bit slower than I wanted — need a little more time past
> today, but for a good reason: the idea got real.
>
> few words: delibera becomes the judgment layer for Agent Connect wallets.
> the agent is allowed to do exactly one thing on its own — buy a private
> verdict from a 3-juror council (whitelisted destination, confidential
> transfer, capped budget). every real spend stays impossible until the jury
> approves AND the owner ratifies with one signature. when the jury says no,
> the wallet itself refuses the payment — you see
> `policy_destination_denied` live on screen.
>
> that's the a-ha: the agent can buy private judgment autonomously, but can't
> move money without a verdict and the signed rules. permissioning isn't a
> feature here, it's the whole product.
>
> the flow already runs against the real deliberation engine with the true
> policy semantics — verdicts settling on-chain today. I'll send you the
> one-pager + a short recording once it's presentable — early next week?

---

## Agent Connect cohort — the pivot point (2026-10-13)

Elliot meet happened. Opportunity: **1 of 10 selected projects** in a cohort to
pitch/demo prototypes built on **NEAR Agent Connect** (NEAR Intents Agent API).
Deadline: **by Oct 16** settle a clear, practical prototype — small, targeted,
~3 screens, with an unmistakable "now this is possible with Agent Connect!"
moment. They audit ideas via
`NEARBuilders/agent-connect-prototypes` `.agents/skills/agent-connect-audit`
(four gates, aggressive). Docs: near-intents Agent API
(docs-production-7968.up.railway.app/integration/agent-api/*). Source of truth:
`NEAR-Intents-Agent-API/skills` repo.

**What Agent Connect is (verified from the skills repo):** each agent gets its
own wallet on NEAR Intents. The owner signs ONE policy (actions, assets,
limits, destinations whitelist, USD budget, timelock, schedule,
`owner_approval`, `confidential` shielded balances, freeze kill-switch) plus
grants (`ngt_`); the backend (`naa_` partner key) then acts autonomously inside
those rules. Hosted API is **mainnet, real funds**
(api.agentsonintents.com). Every execution has a verifiable proof; API runs in
attested TEE. Approval flow: `owner_approval: true` → executions go
`PENDING_APPROVAL` until the owner votes. Confidential transfers between
Intents accounts exist (`confidential: true`).

### The prototype concept: "The council inside the spending rules"

A spending assistant agent with its own Agent Connect wallet. The owner's
signed policy: the agent may pay ONLY the Delibera oracle autonomously
(destination whitelist, $0.05/tx, $5/month budget — confidential transfer), and
every real spend waits for owner approval. The flow:

1. **Chat:** "should we pay vendor.near 20 USDC for the audit report?" → the
   agent autonomously buys a verdict ($0.05 confidential transfer to delibera —
   a *private payment for a private verdict*, invisible on-chain).
2. **Signature moment:** 3 jurors deliberate privately → the owner gets ONE
   approval request with the verdict attached (2–1 Approved + reasoning
   summary) → votes with their wallet.
3. **Result:** transfer executes with tx hash — and the **bite**: on the
   Rejected run, the jury says no, the owner declines (or the agent never
   submits), and if you force the spend the wallet's own rules refuse it live
   (`PENDING_APPROVAL` that never clears / `budget_exceeded` when the $5
   verdict budget is spent).

**A-ha (one sentence):** "My agent can buy a private second opinion by itself —
but the money only moves when the verdict says yes AND my signed rules agree."

**Four-gate self-audit:** Gate 1 ✅ — load-bearing: destinations whitelist
(oracle-only autonomous spend), USD budget (verdict cap), `owner_approval`
(PENDING_APPROVAL gate), confidential transfer (privacy matches the product).
Remove owner-signed policies and it degenerates to a custodial chatbot. Gate 2
✅ — 3 screens, guardrail bites at 0:45. Gate 3 ✅ — aha is policy-governed
agency, not generic agents+crypto. Gate 4 ✅ — roles: partner = Delibera BFF
(`naa_`), owner = browser wallet, agent = `ngt_` grant; one artifact (small
BFF + 3-screen UI) reusing the proven verdict engine (#64 flow untouched).

**Strategic fit:** keeps the 30-day test alive — the verdict oracle is the same
service; Agent Connect becomes its payment+execution rail for this surface, and
the cohort IS the distribution (Elliot's "x402" point maps to the $0.05
agent-to-agent payment). Delibera's positioning from the frame holds exactly:
**advisory layer, never decision layer** — the owner still signs; the council
informs.

**Open questions for manza (before writing the experiment doc):** see chat —
partner key, scope, x402 meaning, deliverable format, mainnet funds, team.

### Answers (2026-10-14)

- Partner key: **manza requests it himself** at partners.near-intents.org
  (blocker — do it today).
- Scope: **keep the verdict engine, wrap with Agent Connect** (recommended
  path).
- x402: unresolved — both readings work; the demo's $0.05 transfer covers
  either. Parked as an open question in the experiment doc.
- Oct-16 deliverable: a clear, practical prototype concept with unmistakable
  a-ha + Agent Connect capability highlight, ~3 screens. **Written:**
  `doc/plans/agent-connect-verdict-gated-spending.md` (house experiment
  format, four-gate clean).
- Mainnet: superseded — the launch post reveals a **demo environment**
  (`https://api.demo.agentsonintents.com`, keys from the Partner Dashboard).
  Prototype targets the demo env; keys are temporary/rotated, so base URL +
  key stay config-only. Mainnet (~$25 USDC, dedicated owner account) is the
  post-demo fallback.

### Agent Connect prototype — BUILT + RUNNING 2026-10-16

- **Second-model review** (Grok, `doc/plans/grok-review-…md`): accurate, no
  invented capabilities; flagged the one real risk (`owner_approval` has no
  documented destination exception). Adopted → the experiment doc now uses the
  docs-verified design: `owner_approval: false` + destinations-only-oracle;
  ratification = owner-signed `policy_update`; the bite = literal
  `403 policy_destination_denied`.
- **Economics fix found by the first demo run:** a tight per-tx cap ($0.10)
  also blocks the ratified $20 vendor payment, and budgets are global per
  account. Final policy: per-tx ceiling $25, total envelope $25/month — the
  *whitelist* directs, the *budget* bounds. Doc + demo aligned.
- **Built (additive, `coordinator-agent/src/agent-connect/`):**
  - `client.ts` — thin Agent API client; env-config only
    (`NEAR_INTENTS_AGENT_API_URL` default `api.demo…`, `…_KEY`); without a key
    runs an in-memory mock enforcing real policy semantics + real error codes
    (`policy_destination_denied`, `budget_exceeded`, `policy_limit_exceeded`).
  - `demo.ts` — terminal demo, 60-second beats, two runs back-to-back, REAL
    verdict engine behind it. Script: `npm run agent-connect:demo`.
- **Verified end-to-end (single clean run, mock wallet + live jurors):**
  - RUN 1: bad proposal → **#68 Finalized Rejected 0–3** → forced spend refused
    `policy_destination_denied`. The bite lands.
  - RUN 2: good proposal → **#69 Finalized Approved 3–0** → owner ratifies →
    $20 vendor transfer succeeds.
  - Jury discriminates correctly in clean state. (Earlier confused tally was
    two demo processes sharing Ensue keys after a shell timeout left the first
    one running — process discipline, not a model issue.)
- **Remaining for the live version:** partner key (`naa_`) from the dashboard
  (manza); real signature flow (owner wallet signs intents — currently
  narrated/simulated in mock); oracle-watcher BFF (inbound transfer → trigger
  verdict) — the demo calls the coordinator directly; optional 3-screen UI
  (audit allows terminal).

### Make-it-real build — IN PROGRESS (started 2026-10-16, post-deadline extension agreed w/ Elliot)

- **Elliot reply v9 sent** (late + idea in few words + "permissioning is the
  product"; recording promised for early next week).
- ✅ **Piece 1 — verdict oracle BFF:** `src/agent-connect/verdict-oracle.ts`
  mounted at `/agent-connect` (POST /verdict → 202 + id; GET /verdict/:id →
  verdict card). Verified live: `v_73793f86` → **proposal #71 Finalized
  Approved 3–0**, full juror reasoning in the card. Poll loop tolerates
  transient fetch errors (bug found + fixed on first test).
- ✅ **Piece 2 — UI 3 screens (mock wallet):** `http://localhost:3000/agent-connect/demo`
  served by the coordinator (no Next.js). Steps: chat → signature/result.
  Session API: `src/agent-connect/demo-routes.ts`. Signature is simulated
  until the `naa_` key + browser NEP-413 signing land (piece 3).
- ✅ **Piece 3a — real signatures + live agent (2026-10-18):** `naa_` key in
  coordinator env (demo env = mainnet contract `outlayer.near`). Owner
  `ac-owner.delibera.near` + oracle `ac-oracle.delibera.near` created via
  near-cli (keys in macOS keychain `near-mainnet-*`). Signed NEP-366 server-side
  (scripts in /tmp/ac-sign, secrets never in repo):
  - **agent_create SUCCESS** — agent
    `c6b8a14d6b2fdd22e6a8c5182955f1dbca86453d71de4ce3e6cf8c96613ed889`,
    policy: transfer-only → ac-oracle (confidential), $0.20 envelope, no
    swap/withdraw. Sponsor paid gas.
  - **grant_issue SUCCESS** — grant `5b194f70…2d7ec`, `ngt_` token stored
    /tmp/ac-sign/grant.json (0600).
  - **Agent NEAR address:** `1688bff53d186ab9981666521f25154001ea6805fa2c6a1175677ba8ea375075`
  - **Asset: NEAR-native USDC** (`nep141:17208628f84f…e36133a1`) — policy
    updated on-chain 2026-10-18 (**revision 2, APPLIED + synced**) with a
    keychain-signed NEP-366 `policy_update`. Code constant updated.
  - **2026-10-19:** manza sent $0.05 USDC to the agent's NEAR address —
    **not lost** (50000 atomic visible on-chain at `1688bff5…`), but this
    deployment does **not** auto-credit direct NEP-141 sends. Funding must
    go through the deposit intent: created `op_WE5Z7u…`, deposit address
    `5b2841ddf7c8fa9c88d8db92aa3648495cdbb4530279ca9927cc5fd56a7aa611`
    (min $0.001, expires 2026-10-25). **Pending: send $0.05 USDC there.**
  - **2026-10-19 UI live wiring done:** coordinator now runs the real flow
    from `http://localhost:3000/agent-connect/demo` — session loads the real
    agent (`AGENT_CONNECT_AGENT_ID` + `AGENT_CONNECT_GRANT_TOKEN` in env),
    balances read via grant, propose shields-then-transfers confidential,
    ratify = server-side owner-signed NEP-366 `policy_update` (keychain key,
    then waits `provider_policy_synced`) + vendor payment.
  - **2026-10-19 first real bite captured:** `POST /demo/{sid}/force-spend`
    against the live API returned **`403 policy_destination_denied`** —
    real refusal, not mock. Recording-ready.
  - **2026-10-19 funding landed:** first address (`5b28…`) rejected by wallets
    (implicit account didn't exist); exact-amount deposit `op_l1pccQe…`
    created, account + USDC storage pre-created from `ac-owner`
    (0.01 NEAR + 0.00125 NEAR), **$0.05 USDC credited** to the agent's
    public balance.
  - **2026-10-19 first real paid verdict (headless):** $0.01 confidential
    transfer SUCCESS to `ac-oracle` (op `op_znmV…`, provider `outlayer`) →
    deliberation `v_ab73c56b` → **Approved 2–1**, proposal #73 settled
    on-chain. Balance: $0.04.
  - **2026-10-19 NEP-413 owner signing implemented:** ownership intents for
    destinations-only changes use `nep413` (message signature, no chain tx);
    `assets` changes use `nep366`. `ownerSignOwner` in `client.ts` branches
    on `intent.standard`; NEP-413 = sha256(tag `2^31+413` ∥ borsh{message,
    nonce[32], recipient, None}) signed with the keychain key. No-op policy
    update verified end-to-end (revision 3, SUCCESS + synced).
  - **Remaining:** browser recording — session → force-spend bite → propose
    (shield $0.01 + real confidential transfer) → verdict → ratify
    (owner-signed policy_update + $0.01 vendor). Ratify needs the 10-min
    policy cooldown from the no-op test to expire (policy_change_available_at
    2026-10-19T20:09:50Z). Budget: $0.04 public → costs $0.02 per full run.
  - **2026-10-19 first full UI run (browser, live):** session ($0.04) →
    shield $0.01 → confidential transfer to oracle → deliberation
    `v_6c93af24` → ratify: owner NEP-413 signature, vendor whitelisted
    (policy **revision 4**: oracle + `ac-owner` as vendor) → vendor
    transfer returned `UNCERTAIN` (op `op_XqAFcc…`) → **settled SUCCESS**
    (`intents_transfer`, provider success). Balance left: $0.02.
  - **Note for next recording:** vendor is now whitelisted (rev 4) — the
    force-spend bite requires removing it first (destinations-only
    `policy_update`, 10-min cooldown). One more full run is affordable
    ($0.02 left → propose $0.01 + ratify $0.01).
  - **2026-10-19 official skills installed:** `NEAR-Intents-Agent-API/skills`
    → `.claude/skills/near-intents-agent-api/` (was NOT installed before —
    work had been driven by live `llms.txt`/`openapi.json`), and
    `NEARBuilders/agent-connect-prototypes` →
    `.agents/skills/agent-connect-audit/` + `.agents/skills/grilling/`.
  - **2026-10-19 implementation audited against the official skill:**
    NEP-413 signer matches `references/signing.md` byte-for-byte (tag, borsh
    body, sha256, base64; verified live); NEP-366 uses `encodeDelegateAction`
    which includes the NEP-461 prefix — also spec-exact and verified live.
    Fixes applied: stable per-step `Idempotency-Key`s (rule 4; no more
    `Date.now()` keys in the demo path) and `/v1/network` health in
    `/demo/meta` (skill: read before acting — currently `operational`).
    Smoke test `scripts/check_api.sh` passes.
  - **2026-10-19 signing verified against the official vectors:** new
    permanent test `coordinator-agent/scripts/verify-agent-connect-signing.ts`
    reproduces `assets/test-vectors.json` byte-for-byte — nep413 signature,
    nep366 `encoded_hex` (NEP-461 prefix) + `signed_delegate`, grant
    commitment, key derivation — prints **ALL VECTORS MATCH**. The skill's
    rule ("any new port must reproduce every vector") is now always-on.
  - **2026-10-19 AGENTS.md created** at the repo root with the four audit
    gates (canonical per the audit skill: AGENTS.md > SKILL.md where both
    exist), source-of-truth pointers to the installed API skill, verdict
    routing to `doc/plans/`, and the project conventions (keys/keychain,
    idempotency, UNCERTAIN, deposit addresses, no-commit rule).
  - **2026-10-19 audit formally run (agent-connect-audit skill):** grilling
    rounds; facts answered from docs/live ops, decisions proposed with
    recommendations, user silence adopted as consent. **Verdict PASS 4/4** —
    every gate backed by already-executed live evidence (403 bite,
    confidential transfer, verdict 2–1, rev 4 synced, vectors). Adopted demo
    decisions: bite as the finale, server-side keychain signing with an
    honest label, vendor = owner account (declared), deterministic invoice
    take + forced bite (real Rejected verdict kept as alternate take).
    Product-scale open questions recorded (oracle discovery/registry, verdict
    proof strength, refund economics, browser-wallet owner keys).
  - **2026-10-19 experiment doc refreshed:** `agent-connect-verdict-gated-spending.md`
    now carries a Status header + an exhaustive **As-built (2026-10-19)**
    section — real accounts, policy revision 4 verbatim, live op/verdict ids,
    funding lessons — superseding the original $0.05/$20 amounts.
  - **2026-10-19 cohort one-pager written:**
    `doc/plans/agent-connect-onepager.md` (English, copy-paste-ready
    opener included, 60-second recording script table, live proof points,
    open questions, run instructions).
  - **2026-10-20 UI v2 — transparency engine (built in REPLAY mode, no
    funds):** audited tight spots (invisible Agent Connect plumbing, buried
    signature moment, static policy caption, no explorer links, bare 403,
    stale create path) and rebuilt the demo UI:
    - **demo-fixtures.ts** — real receipts harvested read-only: policy rev 4
      with its hash (`a43547…e3ed`), op records with full status timelines and
      intent hashes (`op_znmV…` 23s; `op_XqAF…` UNCERTAIN→SUCCESS 106s),
      proposal #74 from testnet RPC (**Finalized Approved 3–0**, 3 DID jurors
      + result hashes), network health. Replay mode = `AGENT_CONNECT_FIXTURES=1`
      (zero API calls, zero funds; the live mode keeps env keys).
    - **demo-routes v2** — structured trace events per step (endpoint,
      Idempotency-Key, statuses incl. UNCERTAIN story, provider, correlation
      id, explorer link); session returns policy + balances + roles strip
      (Requestor agent · Council jurors · Finance owner, NEAR Business
      vocabulary); ratify returns the NEP-413 payload for the signature card;
      **safety guard**: live force-spend is suppressed while the vendor is
      still whitelisted (would move real funds).
    - **demo-page v2** — two-column layout (flow + sticky audit rail): live
      policy card (rev/destinations/usage mutating on ratify), wallet split
      public vs confidential, per-step API receipts with status chips and
      explorer links, juror lanes with DID receipts, signature moment
      (NEP-413 payload shown, honesty badge for server-held key), 403
      anatomy card, final confidential-receipt screen with copyable evidence
      JSON, honesty badges everywhere (replay vs live, self-payment vendor).
    - Verified end-to-end in replay: session → propose (shield+transfer with
      real op id/timeline) → verdict 409→**Approved 3–0 #74** → ratify
      (signature card + rev 4) → bite (403 anatomy). Live-mode GET checks only
      (meta/network operational); **no live POSTs executed**.
  - **Scenario anchored to NEAR Business (`business.near.com`):** their
    "council" = human multisig members with 3-day voting durations; zero
    agent/AI surface in all 13 docs pages (llms.txt verified). Delibera = the
    missing agent layer over the same confidential rails — role vocabulary
    (Requestor/Council/Finance) now shown in the demo UI.
- ⏳ Piece 4 — watcher: match inbound oracle transfers → auto-trigger
  deliberation (payment-gated verdicts), behind env flag.

---

## Execution log

### Task 1 — DONE 2026-10-04

Flow revived and settled end-to-end. **Proposal #62, state `Finalized`** on
`coordinator.agents-coordinator.testnet`; on-chain `finalized_result`:
`{approved: 0, rejected: 3, decision: "Rejected", workerCount: 3}` — verifiable
by anyone via `get_proposal(62)` on testnet RPC (testnet nearblocks indexer is
stale since ~Jun 2026; use the RPC view call as the proof artifact).

- Proposal: "Fund a developer education program" → 0–3 Rejected; workers gave
  substantive independent reasoning (e.g. "lacks technical specificity …
  curriculum, budget, success metrics") with per-worker verification proofs.
- Timing: trigger → finalized ≈ 85–90s (inside the ~100s yield budget, tight).
- Fixes required (all applied):
  1. `NEAR_AI_API_KEY` (new funded key) added to the 3 worker env files;
     `ai-voter.ts` prefers it over legacy `NEAR_API_KEY`.
  2. Model: `deepseek-ai/DeepSeek-V3.1` is REMOVED from the NEAR AI catalog →
     default now `deepseek/deepseek-v3.2`, overridable via `NEAR_AI_MODEL`
     (CLAUDE.md updated).
  3. `LOCAL_MODE` in coordinator env was `false` (leftover from a Phala
     attempt) → restored to `true`.
  4. `.env.example` documents `NEAR_AI_API_KEY` + `NEAR_AI_MODEL`.
- Non-issues observed: stale ngrok worker in registry (coordinator snapshotted
  only the 3 live workers); transient DNS failure window (a VPN resolver —
  killed the first attempt; clean on retry). Watch both in task 2 hosting.
- Services currently running locally: coordinator :3000, workers :3001-3003
  (LOCAL_MODE, no frontend/protocol-api).

**Unblocked:** the Elliot reply (see draft above) — the live artifact exists.

### Task 2 — DONE 2026-10-05

- **Model evaluation:** `openai/privacy-filter` is in the NEAR AI catalog but
  NOT servable (chat completions 404 at provider; `/v1/moderations`
  unimplemented). It's an internal guardrail, not an inference model — rejected.
  Staying on `deepseek/deepseek-v3.2`.
- **Market interface:** market.near.ai v2 is live with a full worker API
  (`/v1`, token `aat_…`, self-registration, assignments poll, escrow handled by
  the market). Decision: **outbound poller, no inbound hosting** — the
  alternative (A2A + x402) requires a public host; the poller doesn't.
- **Registered:** handle `delibera` (agentId 213a0dde-fcfe-4614-9f92-aa6dc4617484);
  token stored in coordinator env (`MARKET_API_TOKEN`). Announcement remains
  task 3.
- **Built:** `coordinator-agent/src/market/market-poller.ts` (additive; fresh
  assignments only, rework/disputes flagged for the founder) + `npm run
  market:poller` + `SERVICE.md` (one-page description; price TBD by founder,
  suggested $1–2).
- **Semantics fix:** `quorum` in voting_config means *minimum approvals to
  pass*, not "minimum voters". First test run (#63, quorum=3) correctly
  returned Rejected on a 2–1 vote — unanimity. Poller now defaults to
  `min_workers: 3, quorum: 2` (majority), matching buyer intuition.
- **Done criterion met — two consecutive clean runs:**
  - Proposal #63 (`Finalized`, Rejected 2–1 under unanimity rule)
  - Proposal #64 (`Finalized`, **Approved 2–1** under majority rule) —
    verified via `get_proposal(64)` on testnet RPC.
- Run time per verdict: ~75–90s.

### Price + payment rail — DECIDED 2026-10-05

**Price: $0.05 USDC per verdict, at cost.** Measured marginal cost: ~$0.005–0.01
inference (3 juror calls on deepseek-v3.2), testnet gas ≈ 0, Ensue free tier;
$0.05 adds retry buffer. Not a margin — the metric is paid demand, not revenue.

**Q: what uses the Stellar x402 rail right now?** Nothing. The coordinator
still *mounts* the x402 router at boot (Stellar env vars are set, `[x402]` log
lines appear), but no buyer, page, or agent points at it — it is inert. The
30-day path never touches it.

**Rail comparison (the "Stellar vs NEAR-native vs other" question):**

| Rail | Status | Verdict |
|---|---|---|
| **Agent Market escrow** (NEAR/USDC) | DONE — zero rail code, escrow + payout are the market's job | **The 30-day rail.** Buyers are already there |
| **x402 on Stellar** (repo: `coordinator-agent/src/x402/`) | Built + demoed; inert today | Dormant. Costs a foreign wallet + OZ facilitator dependency; chain-incongruent with the NEAR-native story (June spec noted this). Keep the code as portability proof; revive only if a buyer explicitly needs Stellar |
| **x402 on NEAR** (NEP-141 + meta-tx facilitator; pattern scouted in June: r-near/x402-near-demo) | Not built | The right rail **if** a per-call inbound surface (A2A on own host) ever appears. Post-validation decision — don't build now |
| **NEAR Intents** | Live inside the market + Trezu | Not a separate project; comes free |

Decision rule from the frame holds: the rail is not the bottleneck — demand is.
One rail (market escrow), one surface (market listing), 30 days.

---

## Frame challenge 2026-10-05: "relaunch delibera.xyz for distribution?"

Challenged via problem-framing-canvas after the founder pushed back on the
site-as-non-goal.

**Look Inward — both assumptions on the table:**
- *Frame's assumption:* "site = the February distribution model; not needed for
  the metric." True for the *platform* — but it conflated the platform with the
  domain. A 404 at delibera.xyz is an active credibility cost the moment the
  announcement goes out (the Vela application already flagged this exact risk:
  "landing page currently down — fix or substitute a working URL").
- *Founder's assumption:* "a live app = distribution." False if it means the
  full app — a dashboard doesn't bring buyers. Partially true if it means *a
  link worth clicking* when Legion/X amplify.

**Look Outward — what job would a site do in these 30 days that current
artifacts don't?**
- J1 credibility: humans clicking from the announcement should not hit a 404. ✅ real
- J2 evidence hosting: the recorded run, the #64 verdict, verify-it-yourself. ✅ real
- J3 agent self-onboarding (skill.md manifest): not needed — workers run
  in-house; permissionless onboarding is post-validation. ❌ out
- J4 buyer self-serve (second storefront, x402): splits the demand test, adds a
  rail — explicitly deferred. ❌ out

**Reframe:** the site is NOT a distribution channel in these 30 days — it is
the *landing page that makes the distribution channels work*. Distribution is
still market + Legion + X. The page's only jobs are J1+J2: make the
announcement credible and route buyers to the market listing.

**Decided:** one static page at delibera.xyz (Vercel deploy, no backend, no
Next.js resurrection) containing: what a verdict is, the #64 verdict as live
evidence, the verify-it-yourself RPC command, honest limits, and one link —
"buy a verdict" → the market listing. Effort cap: half a day, executed as part
of task 3 (before the announcement, so posts link somewhere alive). Anything
beyond the one page remains a non-goal.
  - **2026-10-20 verdict disclosure tiers (product decision + build):** the
    buyer picks how much of the council is revealed when purchasing a verdict:
    **sealed** (default-business option: tally + per-juror DID/result-hash
    commitments, timestamps proving votes existed pre-tally — process
    verifiable, opinions protected) / **attested** (demo default: per-juror
    vote + reasoning released, each `sha256`-verifiable against its on-chain
    commitment, tally = Σ votes) / **open** (roadmap only: public reasoning =
    reputation mode, juror-consent required, anti-bribery anonymity respected).
    Built in demo + replay receipts (#74 Approved 3–0 real), docs updated
    (one-pager tier matrix, experiment-doc addendum). Result-hash timestamps:
    sub-tally on-chain (`T_juror < T_final`) — unsealing later is safe by
    construction.
  - **2026-10-21 scope doc for Elliot:**
    `doc/plans/delibera-scope.md` — presentation scope (not a program
    application): path to today, Agent Connect focus, proposed roadmap.
    Rewritten the same day to the longer draft: two-network split (demo API
    on mainnet Intents contract vs testnet tally), advisory-not-decision
    rule, phase order without dates.
  - **2026-11-04 hackathon research:** `doc/plans/near-hackathon-2026.md`
    extended with live 1Click rail facts (215 tokens, no tokenized
    equities; Earn receipts gtUSDCp/TLO/kV-gtSOLb; `stNEAR`;
    confidentiality basic/advanced; CONFIDENTIAL_INTENTS) and an Open
    Agents showcase curation (15 pages, ~440 projects; Nuncius = our prior
    submission). Verdicts: idea 1 stays lead (verdict-gated spending
    merges the two saturated families no one bridged), idea 2 downgraded
    (hire/pay saturated), confidential-swarm treasury kept as uncertain
    add-on pending dry quotes, kill-switch watcher and compute-only wallet
    filed as pitch variants, not plan C. User decision on idea pending.
    Same day, follow-up: nine Open Agents detail pages read in full
    (Conclave, AgentVault, SBO3L, Agent-911, Zuno, Murmur, AgentMandate,
    Ledger Grove, Pantheon) — transplants logged in the hackathon doc with
    target days: AgentVault-style proof explorer with `?run=` force
    sequences, SBO3L no-key grep test + self-contained `capsule.json` +
    browser `verify.html`, Agent-911 watchdog framing, Zuno
    deterministic-math + explain-before-sign panel, Conclave fixtures
    justification + "policy bites at execution" contrast, Murmur
    bit-identical-demo line, ready-to-paste curl receipts, Pantheon
    on-chain-verdict framing. No new work streams opened.
  - **2026-11-04 build plan:** `doc/plans/near-hackathon-build-repo-plan.md`
    — user picked idea 1 and a fresh public repo (`delibera` recommended)
    for the hackathon build; plan covers repo skeleton (tsx, no framework,
    static verify/panel HTML), migration table (client.ts, signing
    vectors, fixtures→JSON incl. proposal #74 + 403/approved receipts,
    policy rev 4; NOT migrated: motor/Ensue/Storacha/env/UI-Next), honest
    baseline-vs-window via README table (rules allow listing own old
    libraries as baseline), day-by-day file-mapped cut (judge script day
    2, hash verifier + ?run=403-recovery + verify.html day 3, TEE spike
    day 4, video day 5-6, X post + supervised POST submission day 7,
    buffer day 8-9), judge moment sequence, house invariants (no secrets
    in new repo, no funds without explicit yes, policy APPLIED+
    provider_policy_synced, signing vectors recheck, idempotency,
    UNCERTAIN polling), risks + first-action checklist. Repo creation
    awaits user "arranca".
  - **2026-11-07 build plan rev 2 (user vetoes):** `delibera` as repo AND
    product name vetoed; repo moves to
    `/Users/manza/Code/hackathon/near-hackathon-26` (product name
    proposal: `Second Opinion`, pending user). Ensue back into the stack
    as the live-deliberation backbone (minimal fetch JSON-RPC client,
    not the `@delibera-xyz/*` workspaces). Mainnet-capable requirement:
    payments already mainnet-proven (demo gateway settles on NEAR
    mainnet, native USDC); the open gap is the tally contract
    `coordinator.agents-coordinator.near` (testnet-proven only) — day-2
    `verify-settlement` view call to check deployment, one gated live
    settle precedent (real gas, explicit user yes) captured as
    `fixtures/settlement-mainnet-receipt.json`; testnet-captured fixture
    sections must stay labeled `testnet-capture` until precedent exists.
    Dropped hard from the migration table: x402+Stellar, Flow VRF,
    Storacha/Lit/Filecoin, ShadeAgent SDK, market poller. My-run stack
    inventory done via subagent (client.ts zero-dep fetch rail; monitor
    has the submission/tally seam to extract; Ensue hosted free tier,
    key claim is human-once).
  - **2026-11-08 day 1 executed (repo born):** product name confirmed
    `Confidential Second Opinion`; repo created at
    `/Users/manza/Code/hackathon/near-hackathon-26` (3 commits: skeleton
    with baseline-vs-window docs, Delibera baseline port, probe/message
    fixes). Ported: client.ts verbatim, official signing vectors +
    verify-signing, four fixtures extracted from demo-fixtures/demo.ts
    (policy.json with the full rev-4 policy document, proposal-74.json
    honestly tagged testnet-capture, receipt-approved/receipt-denied),
    verdict-fixture replay, contract settlement seam, ensue mini-client
    with exact JSON-RPC arg shapes from the ensue skill. Verification:
    `npm run fixtures` green fully offline; `verify:signing` → ALL
    VECTORS MATCH; `verify:settlement` → **mainnet contract
    `coordinator.agents-coordinator.near` is LIVE (proposal id 0, fresh)
    and testnet reports id 74** — the biggest rev-2 risk (undeployed
    mainnet contract) resolved without a deploy; remaining gated item is
    the day-2 live settle precedent (proposal #1). gga pre-commit hook
    installed in the new repo. Package note: @near-js/* use their own
    version scheme (2.5.1, not near-api-js 5.x). gga pre-commit hook
    installed in the new repo.
