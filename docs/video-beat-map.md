# Video beat map — 60 seconds

Everything below is already running or one command away. No staging, no mockups:
the UI you record is the product, talking to the live API.

**Before recording** (one terminal each):

```sh
# terminal 1 — the coordinator (holds the partner key; the browser never sees it)
cd coordinator-agent && npm run dev

# terminals 2-4 — the three jurors
cd ../worker-agent && npm run dev:worker1     # + dev:worker2 / dev:worker3
```

Check: `curl -s localhost:3000/agent-connect/demo/meta` → `"mode":"live"`.

---

## Beat 1 · 0:00 — the wallet and its rules

**Show:** `http://localhost:3000/agent-connect/demo` (the session rail, LIVE badge).
**Say:** *"This is an agent wallet with real USDC. It can only transfer to two addresses —
the oracle that sells the verdict and the vendor. Its rules are an owner-signed policy on
the NEAR Intents Agent API, not a prompt."*

**Proof on screen:** the policy card — revision 4, `APPLIED`, `provider_policy_synced: true`,
the destination list, the $0.20 daily budget.

## Beat 2 · 0:12 — the wallet tries to pay, and is refused

**Do:** type the ask, press **Buy the verdict** → the oracle leg fails on the empty balance
(honest: the demo account holds no USDC — say so), then the jury deliberates.
**Show:** the three juror lanes appearing, each with its own reasoning and `resultHash`.

**Say:** *"Three independent agents with persistent identities judge it privately. Only the
hash of each result reaches the chain — the reasoning stays sealed. And each reply carries a
NEAR AI Cloud signature: the key that signed it is bound to real Intel TDX hardware."*

## Beat 3 · 0:32 — the verdict, settled on-chain

**Show:** the verdict card — decision, the proposal id, the contract link.
**Say:** *"Approved 3-0 — or 2-1 when one of them dissents, which is what happened in our
reference run. The tally settled on NEAR, and the committed hash still equals the bytes in
the deliberation store."*

## Beat 4 · 0:44 — the guardrail bites (the moment)

**Do:** press **Try the spend anyway (the bite)**.
**Show:** the refusal — `403 policy_destination_denied`, the provider's own detail, the
request_id.

**Say:** *"The vendor is not on the whitelist, so the API refused before dispatch. Nobody
pressed 'approve' — the wallet simply could not. The refusal comes from the provider, not
from our code."*

## Beat 5 · 0:52 — what it would take to open it

**Show:** the policy card / the README's `live:rail` receipt.
**Say:** *"One owner signature adds the destination. That is the whole product: the only
autonomous power this wallet has is buying a second opinion."*

---

## Cutaways to interleave (optional, 2-3 seconds each)

| Cutaway | What it shows | Command |
|---|---|---|
| the evidence | the judge sequence, 30 s, offline | `cd hackathon/evidence && npm run judge` |
| the TEE | 3/3 signatures + TDX quotes verified | `npm run verify:tee` |
| the precedent | chain + receipt + live memory, one command | `npm run verify:live` |
| the capsule | drag the capsule, digests re-derive in-browser | `open hackathon/evidence/web/verify.html` |

## If the network misbehaves mid-take

The live session has a **replay mode** (same UI, fixtures instead of the API):
`AGENT_CONNECT_FIXTURES=1 npm run dev` in the coordinator. Record the live take first;
keep the replay as the backup take. Do not mix them in one take — the badge says which
mode you are in, and a judge will read it.

## Honesty rules for the recording

- If the oracle leg shows `insufficient_balance`, **say so**: the demo account holds no
  USDC. That is true and it is more credible than a hidden top-up.
- Do not claim the payment succeeded live. The payment leg in the demo is a captured
  receipt from 2026-10-19; the live legs are the refusal, the jury and the settlement.
- Show the request_id. It is the receipt.
