# X post draft

Post it yourself from your own account (the rules say the human publishes). Attach the
demo video. Keep the first line understandable to someone who has never heard of the project.

---

I built a wallet that can only buy a second opinion. 🧵

An AI agent holds real USDC and wants to pay a vendor. It can't.

Not because we wrote a prompt saying "be careful" — because its spend is governed by an
owner-signed policy on the NEAR Intents Agent API. A destination whitelist, a USD budget, a
per-transaction cap. Pay anyone outside that whitelist and the API refuses, before
dispatch, with `403 policy_destination_denied`.

So the wallet has to earn the right to pay: it buys a second opinion first.

Three private AI agents, each with its own persistent identity and memory, review the
contested decision independently. Each juror commits only a sha256 of its result on-chain —
the reasoning stays sealed, and the tally settles the verdict on NEAR. Verdict green plus
one owner signature opens the destination. Only then does the money move.

Built at @NEARProtocol hackathon — what NEAR is actually doing here:

• NEAR Intents — where the money moves and where the policy is enforced (by the provider,
  not by our code)
• NEAR AI Cloud — where the reasoning is produced, and every reply carries a signature; we
  verify with NEAR's own verifier that the key that signed it is bound to real Intel TDX
  hardware
• a NEAR contract — where the verdict settles

What we proved, and how to check it yourself:
• a live 403 from the provider, captured with its own error body and request_id
• three real jurors, one dissenter, settled on-chain — and the committed hashes still equal
  the live bytes
• the TEE proof for each juror, verifiable offline
• one command that replays every receipt in 30 s, no key needed

Our own harness had three real bugs — a tally computed on the wrong bytes, a stale-result
wait, a silent no-op in the memory store. Each was found by checking the evidence instead of
trusting it. Each is fixed, and each is disclosed in the receipt. We'd rather show you a
disclosed bug than a tidy lie.

Repo (public, MIT): <REPO_URL>
Demo: <VIDEO>

Question for you: if your agent could buy exactly one thing by itself, what would you let
it buy?

#NEARHackathon @NEARProtocol @NearBuilders
