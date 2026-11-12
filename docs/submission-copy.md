A wallet that can only buy a second opinion.

We built Confidential Second Opinion on the NEAR Intents Agent API. An agent holds real
USDC and wants to pay a vendor. It cannot: its spend is governed by an owner-signed policy
— a destination whitelist, a USD budget, a per-transaction cap — and a payment outside that
whitelist is refused by the API itself, before dispatch, with 403 policy_destination_denied.

To open a destination, the wallet first buys a second opinion. Three private AI agents,
each with its own persistent identity and memory, review the contested decision
independently. Each juror commits only a sha256 of its result on-chain; the reasoning stays
sealed, and the tally settles the verdict on NEAR. Each reply also carries a NEAR AI Cloud
signature, and NEAR's own official verifier confirms the key which signed it is bound to
genuine Intel TDX hardware — the proof travels inside the sealed result, so the on-chain
commitment covers it. Verdict green plus one owner signature (NEP-413) opens the
destination, and only then does the money move.

What is proven, and how to check it: a live 403 from the provider, captured with its own
error body and request_id; a real deliberation of three jurors that settled on-chain with
one dissenter (Approved 2-1), where the committed hashes still equal the live bytes; TEE
proofs for all three jurors, verifiable offline; and a judge sequence that replays every
captured receipt in 30 seconds without a key. Our harness
had three real bugs — a tally computed on the wrong bytes, a stale-result wait, a silent
no-op in the memory store — each found by checking the evidence rather than trusting it,
each fixed and disclosed.

NEAR is the point, not the wrapper: NEAR Intents is where the money moves and the policy is
enforced, NEAR AI Cloud is where the reasoning is produced and attested, and a NEAR contract
is where the verdict is settled. The wallet's only autonomous power is buying judgment;
everything else waits for a human.
