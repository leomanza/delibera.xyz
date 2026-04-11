# Delibera x402 — Stellar Hackathon Implementation Plan

> **Hackathon**: Stellar Hacks: Agents (DoraHacks)
> **Deadline**: April 13, 2026, 17:00 UTC
> **Prize Pool**: $10,000 USD
> **Submission Requirements**: Open-source repo + README + 2-3 min demo video + real Stellar testnet/mainnet transactions
> **Tags**: Blockchain, Claude, Agents, AI, x402, Stellar

---

## One-Liner

**Delibera is a paid deliberation oracle: any AI agent pays USDC on Stellar via x402, triggers a real multi-agent governance cycle backed by Ensue shared memory and NEAR on-chain settlement, and gets a cryptographically-signed verdict back — no API keys, no human in the loop.**

---

## Strategy: Build ON TOP of Existing Delibera

This is **not** a greenfield rewrite. The existing `near-shade-coordination/` repo has a working V1 flow:

```
POST /api/coordinate/trigger
  → Coordinator writes task to Ensue
  → Workers poll Ensue, fetch proposal
  → Workers vote via NEAR AI (DeepSeek-V3.1) with verification proofs
  → Workers write results to Ensue
  → Coordinator detects completion, tallies
  → Coordinator resumes NEAR contract with decision
  → On-chain settlement
```

**What we add**: An x402 payment gateway layer on Stellar that sits in front of this flow. External agents pay USDC to submit proposals and retrieve verdicts. The deliberation itself still uses the real Delibera stack — Ensue, NEAR AI workers, NEAR contracts — not toy Claude calls.

**This is the competitive advantage**: While other hackathon submissions will wrap a single LLM call behind x402, Delibera has an actual multi-agent coordination protocol with shared memory, autonomous worker identities, and on-chain settlement. The x402 layer unlocks it as a public paid service.

---

## What Changes vs What Stays

### Stays Exactly As-Is (DO NOT MODIFY)
- `coordinator-contract/` — Rust smart contract (yield/resume)
- `registry-contract/` — worker registration
- `worker-agent/` — workers, Ensue polling, NEAR AI voting, task-handler
- `shared/` — ensue-client, types, constants
- `coordinator-agent/src/monitor/memory-monitor.ts` — tally logic
- `coordinator-agent/src/contract/` — NEAR contract interaction
- `coordinator-agent/src/storacha/` — encrypted persistence
- All existing `.env` files and configuration

### Gets Extended (Additive Changes Only)
- `coordinator-agent/src/routes/` — NEW x402-gated routes alongside existing ones
- `coordinator-agent/src/index.ts` — mount x402 middleware + new routes
- `coordinator-agent/package.json` — add x402 + Stellar dependencies
- `shared/src/types.ts` — add Stellar payment metadata types (optional)

### New Files
- `coordinator-agent/src/x402/` — x402 middleware config, Stellar setup
- `coordinator-agent/src/routes/x402-deliberate.ts` — paid proposal submission
- `coordinator-agent/src/routes/x402-verdict.ts` — paid verdict retrieval
- `coordinator-agent/src/routes/x402-info.ts` — free service discovery endpoint
- `x402-client/` — standalone x402 client demo (new top-level folder)
- Root-level `README-x402.md` or updated `README.md` section

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  External Agent (x402-client/)                                │
│  Pays USDC on Stellar → submits proposal → retrieves verdict  │
└──────────┬──────────────────────────────────────┬─────────────┘
           │ POST /x402/deliberate               │ GET /x402/verdict/:id
           │ (402 → pay USDC → retry)            │ (402 → pay USDC → retry)
           ▼                                      ▼
┌───────────────────────────────────────────────────────────────┐
│  coordinator-agent (Hono :3000)                                │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  x402 Middleware (@x402/hono + ExactStellarScheme)    │     │
│  │  Settles USDC on Stellar testnet via OZ Channels.     │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  NEW: /x402/deliberate  ──→  Calls existing trigger logic     │
│  NEW: /x402/verdict/:id ──→  Reads from Ensue + verdict store │
│  NEW: /x402/info        ──→  Service discovery (free)         │
│                                                                │
│  EXISTING: /api/coordinate/trigger   (still works, no x402)   │
│  EXISTING: /api/coordinate/status                              │
│  EXISTING: /api/coordinate/workers                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  memory-monitor.ts (unchanged)                        │     │
│  │  Polls Ensue → detects worker completion → tallies    │     │
│  │  → resumes NEAR contract                              │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
┌─────────────────────┐   ┌──────────────────────────────────┐
│  Ensue Memory Network│   │  Worker Agents (:3001-3003)      │
│  Shared coordination │   │  Poll Ensue → NEAR AI vote       │
│  state, task status, │   │  → write result to Ensue          │
│  verdicts, proposals │   │  (completely unchanged)           │
└─────────────────────┘   └──────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  NEAR Testnet                  │  Stellar Testnet            │
│  yield/resume contracts        │  x402 USDC payments         │
│  on-chain decision settlement  │  Coinbase facilitator       │
│  (existing, unchanged)         │  (NEW payment rail)         │
└─────────────────────────────────────────────────────────────┘
```

**Two blockchains, two purposes**: NEAR handles governance settlement (existing). Stellar handles payment settlement (new). This is genuinely novel — a cross-chain architecture where you pay on one chain and the governance executes on another.

---

## Tech Stack (Additions Only)

> **IMPORTANT**: The coordinator-agent uses **Hono** (`@hono/node-server`), NOT Express.
> Use `@x402/hono` instead of `@x402/express`. Same API surface (`paymentMiddlewareFromConfig`).

| New Dependency | Purpose |
|---|---|
| `@x402/hono` | x402 payment middleware for Hono (v2.9.0) |
| `@x402/core` | Core x402 types, `HTTPFacilitatorClient` (v2.9.0) |
| `@x402/stellar` | Stellar-specific x402 scheme (`ExactStellarScheme`) (v2.9.0) |
| `@x402/fetch` | x402 client for the demo agent (v2.9.0) |
| `@stellar/stellar-sdk` | Stellar transaction building and signing (v14+) |

**Facilitator**: Use OpenZeppelin Channels (`https://channels.openzeppelin.com/x402/testnet`),
NOT `www.x402.org/facilitator`. OZ Channels is the production Stellar x402 facilitator that
sponsors network fees (clients need zero XLM).

Everything else (Ensue, NEAR AI, near-api-js, Storacha, Lit) is already installed.

---

## CLAUDE.md (Project Rules for Claude Code)

Place this at the repo root: `near-shade-coordination/CLAUDE.md`

```markdown
# Delibera x402 Stellar Hackathon — Claude Code Rules

## Context
Adding x402 payment gateway on Stellar to the existing Delibera governance protocol.
Hackathon deadline: April 13, 2026. SHIP FAST. DO NOT REFACTOR.

## The Golden Rule
DO NOT MODIFY any existing file unless explicitly listed in the plan.
All x402 code is ADDITIVE. The existing V1 flow must continue to work
exactly as before via /api/coordinate/* routes.

## Existing Stack (DO NOT TOUCH)
- coordinator-contract/ — Rust NEAR smart contract
- registry-contract/ — Rust registry contract
- worker-agent/ — worker agents (3 instances, poll Ensue, NEAR AI voting)
- shared/src/ensue-client.ts — Ensue API wrapper
- coordinator-agent/src/monitor/memory-monitor.ts — tally + NEAR resume
- coordinator-agent/src/contract/ — NEAR contract interaction
- coordinator-agent/src/storacha/ — Storacha + Lit encryption
- coordinator-agent/src/phala/ — Phala TEE deployment
- frontend/ — Next.js dashboard

## Files You CAN Create
- coordinator-agent/src/x402/config.ts — x402 + Stellar configuration
- coordinator-agent/src/x402/middleware.ts — x402 middleware setup
- coordinator-agent/src/routes/x402-deliberate.ts — paid proposal endpoint
- coordinator-agent/src/routes/x402-verdict.ts — paid verdict endpoint
- coordinator-agent/src/routes/x402-info.ts — service discovery (free)
- coordinator-agent/src/x402/verdict-store.ts — verdict tracking
- x402-client/client.ts — standalone demo client
- x402-client/package.json

## Files You CAN Modify (Carefully)
- coordinator-agent/package.json — ADD x402 + Stellar dependencies
- coordinator-agent/src/index.ts — MOUNT new x402 routes + middleware
  DO NOT change existing route mounting or server startup logic.
  ADD new imports and app.use() calls at the END of the route section.
- coordinator-agent/.env.development.local — ADD Stellar env vars at bottom
- Root package.json / run-dev.sh — ONLY if needed to add x402-client script

## How the Existing Flow Works (Reference)
1. POST /api/coordinate/trigger with taskConfig JSON
2. Coordinator calls start_coordination() on NEAR contract (yield promise)
3. Coordinator writes task to Ensue: coordination/config/task_definition
4. Coordinator sets worker status keys to "pending" in Ensue
5. Workers poll Ensue, detect pending status
6. Workers fetch proposal, call NEAR AI (DeepSeek-V3.1), get verification proof
7. Workers write {vote, reasoning} to Ensue: coordination/tasks/workerN/result
8. memory-monitor.ts detects all workers done (polls every 5s)
9. Coordinator tallies votes
10. Calls coordinator_resume on NEAR contract with {approved, rejected, decision}

## How x402 Routes Hook In
- POST /x402/deliberate:
    1. x402 middleware verifies Stellar USDC payment
    2. Route handler formats the proposal into taskConfig JSON
    3. Calls the SAME trigger logic that /api/coordinate/trigger uses
    4. Stores proposalId + Stellar payment metadata in verdict-store
    5. Returns { proposalId, status: "processing" }

- GET /x402/verdict/:id:
    1. x402 middleware verifies payment
    2. Reads from verdict-store (which is populated by polling Ensue)
    3. Returns full verdict with agent votes, tally, NEAR tx hash, Stellar payment hash

## Environment Variables (New — append to .env.development.local)
STELLAR_SERVER_ADDRESS=G...       # Stellar address receiving USDC
STELLAR_NETWORK=stellar:testnet
X402_FACILITATOR_URL=https://www.x402.org/facilitator
X402_PRICE_DELIBERATE=0.01
X402_PRICE_VERDICT=0.002

## For x402-client/ (separate .env)
STELLAR_PRIVATE_KEY=S...          # Client wallet secret key
DELIBERA_SERVER_URL=http://localhost:3000

## Code Style
- TypeScript, async/await, no callbacks
- Minimal code. No unnecessary abstractions.
- Clear comments explaining what each function does
- Follow existing patterns in coordinator-agent/src/routes/

## Key Resources (fetch with Haiku before coding)
Before writing any x402 code, fetch and read these using Haiku:
- x402 Quickstart (exact server+client pattern): https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide
- x402 on Stellar (protocol overview): https://developers.stellar.org/docs/build/agentic-payments/x402
- Built on Stellar Facilitator (middleware setup): https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar
- x402-stellar repo (canonical examples): https://github.com/stellar/x402-stellar
- x402 MCP server (MCP client reference): https://github.com/jamesbachini/x402-mcp-stellar
- x402 Community Demo (minimal e2e): https://github.com/jamesbachini/x402-Stellar-Demo
- Coinbase x402 repo (core protocol): https://github.com/coinbase/x402
- Stellar llms.txt (machine-readable docs): https://developers.stellar.org/llms.txt

## Skills to Install
- stellar-dev skill: https://github.com/stellar/stellar-dev-skill
- OpenZeppelin skills: /plugin marketplace add OpenZeppelin/openzeppelin-skills
```

---

## Implementation Steps (Ordered for Claude Code)

### Phase 0: Research Resources & Install Skills (DO THIS FIRST)

Before writing any code, Claude Code should fetch and read the relevant hackathon
resources using Haiku. The full resource list lives at:
https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp/resources

**Fetch and read these docs (use Haiku for speed):**

```
ESSENTIAL — Read before writing any x402 code:

1. x402 Quickstart Guide (the exact server + client pattern we're implementing):
   https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide

2. x402 on Stellar overview (protocol flow, compatible wallets, facilitator options):
   https://developers.stellar.org/docs/build/agentic-payments/x402

3. Built on Stellar x402 Facilitator (middleware setup with OpenZeppelin Relayer):
   https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar

4. x402-stellar GitHub repo (canonical examples, simple-paywall demo, env vars):
   https://github.com/stellar/x402-stellar

5. x402 MCP server for Stellar (reference for how MCP clients pay x402 services):
   https://github.com/jamesbachini/x402-mcp-stellar

6. x402 Community Demo (minimal local demo — payer + server + facilitator):
   https://github.com/jamesbachini/x402-Stellar-Demo

7. Coinbase x402 protocol repo (core protocol, types, facilitator spec):
   https://github.com/coinbase/x402

REFERENCE — Skim for context, don't deep-read:

8. Stellar llms.txt (machine-readable docs digest, good for quick lookups):
   https://developers.stellar.org/llms.txt

9. Contract Authorization (Soroban auth model — needed to understand x402 signing):
   https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization

10. Signing Soroban Invocations (auth-entry signing used in x402 payment flow):
    https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations

11. x402 Facilitator Supported Networks (verify stellar:testnet is supported):
    https://www.x402.org/facilitator/supported

12. xlm402.com (live test services to validate your client wallet works):
    https://xlm402.com
```

**Install these Claude Code skills:**

```
# Stellar development skill — covers Soroban, SDKs, RPC, wallet integration
# Invoke with stellar-dev:stellar-dev
Fetch skill from: https://github.com/stellar/stellar-dev-skill

# OpenZeppelin skills — contract patterns, Relayer, x402 facilitator
/plugin marketplace add OpenZeppelin/openzeppelin-skills
```

**Useful tools to bookmark (don't install, just know they exist):**

```
- Stellar Lab (wallet creation, funding, trustlines): https://lab.stellar.org
- Circle Testnet Faucet (get testnet USDC): https://faucet.circle.com
- Stellar Sponsored Agent Account (create USDC wallet without XLM):
  https://github.com/oceans404/stellar-sponsored-agent-account
  Skill: https://stellar-sponsored-agent-account.onrender.com/SKILL.md
- x402 Demo (live payment flow to test against): https://stellar.org/x402-demo
```

**Skip these (not relevant to this build):**

```
- MPP / Stripe docs — we're using x402 only, not MPP
- Anchor Integration / SEP flows — not doing fiat on/off-ramp
- DeFi integrations (Blend, Soroswap, Phoenix) — not relevant
- Scaffold Stellar / Stellar CLI — not deploying Soroban contracts
- Smart Account Kit / Passkeys — not needed for server-side x402
- Free AI Setup guide — we already have Anthropic API access
```

---

### Phase 1: Install Dependencies + x402 Config

```
Step 1.1: Add dependencies to coordinator-agent
  cd coordinator-agent
  npm install @x402/core@2.9.0 @x402/hono@2.9.0 @x402/stellar@2.9.0 @stellar/stellar-sdk

Step 1.2: Create coordinator-agent/src/x402/config.ts
  - Import dotenv (already used by the project)
  - Export:
      STELLAR_SERVER_ADDRESS (from env)
      STELLAR_NETWORK (from env, default "stellar:testnet")
      X402_FACILITATOR_URL (from env, default "https://channels.openzeppelin.com/x402/testnet")
      OZ_API_KEY (optional on testnet, required on mainnet)
      X402_PRICES = { deliberate: "$0.01", verdict: "$0.002" }

Step 1.3: Create coordinator-agent/src/x402/middleware.ts
  - Import paymentMiddlewareFromConfig from @x402/hono
  - Import HTTPFacilitatorClient from @x402/core/server
  - Import ExactStellarScheme from @x402/stellar/exact/server
  - Construct the middleware using the canonical Stellar quickstart signature:
      paymentMiddlewareFromConfig(
        routes: {
          "POST /x402/deliberate": {
            accepts: {
              scheme: "exact",
              price: X402_PRICES.deliberate,
              network: STELLAR_NETWORK,
              payTo: STELLAR_SERVER_ADDRESS,
            },
          },
          "GET /x402/verdict/:id": {
            accepts: {
              scheme: "exact",
              price: X402_PRICES.verdict,
              network: STELLAR_NETWORK,
              payTo: STELLAR_SERVER_ADDRESS,
            },
          },
        },
        new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL, createAuthHeaders }),
        [{ network: STELLAR_NETWORK, server: new ExactStellarScheme() }]
      )
  - Export createX402Middleware() returning a Hono MiddlewareHandler

Step 1.4: Add Stellar env vars to coordinator-agent/.env.development.local
  APPEND (do not overwrite):
    STELLAR_SERVER_ADDRESS=G_YOUR_TESTNET_ADDRESS
    STELLAR_NETWORK=stellar:testnet
    X402_FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
    OZ_API_KEY=                                    # optional on testnet

Step 1.5: Mount middleware in coordinator-agent/src/index.ts
  - ADD import for createX402Middleware
  - ADD import for x402Router (created in Phase 2)
  - AFTER the existing route mounting section (`app.route('/api/coordinate', ...)`), ADD:
      app.use('/x402/*', createX402Middleware())   // Hono: wildcard scoping
      app.route('/x402', x402Router)
  - The middleware MUST come before the route mount, so 402s are generated before
    the handlers run.
  - DO NOT change any existing code in this file

Step 1.6: Test the 402 handshake
  - Start coordinator: pnpm dev (or however it currently starts)
  - curl -X POST http://localhost:3000/x402/deliberate
  - Should return HTTP 402 with X-PAYMENT headers containing Stellar payment info
  - If this works, Phase 1 is DONE
```

### Phase 2: x402 Route Handlers

```
Step 2.1: Create coordinator-agent/src/x402/verdict-store.ts
  - Simple in-memory Map<string, VerdictRecord>
  - Interface VerdictRecord {
      proposalId: string;
      proposal: string;
      context?: string;
      stellarPaymentTx?: string;  // from x402 settlement
      nearTxHash?: string;        // from NEAR contract resume
      status: "processing" | "completed" | "failed";
      verdict?: {
        votes: Array<{ workerId: string; vote: string; reasoning: string }>;
        tally: { approved: number; rejected: number; decision: string };
      };
      createdAt: string;
      completedAt?: string;
    }
  - Functions: save(record), get(id), updateFromEnsue(id, ensueData)
  - Export singleton store instance

Step 2.2: Create coordinator-agent/src/routes/x402-info.ts
  - GET /x402/info (NO x402 payment — this is free, for service discovery)
  - Returns JSON:
    {
      service: "delibera",
      description: "Paid multi-agent deliberation oracle",
      version: "1.0.0",
      networks: {
        payment: "stellar:testnet (USDC via x402)",
        governance: "NEAR testnet (on-chain settlement)"
      },
      endpoints: {
        deliberate: { method: "POST", path: "/x402/deliberate", price: "$0.01 USDC" },
        verdict: { method: "GET", path: "/x402/verdict/:id", price: "$0.002 USDC" },
        info: { method: "GET", path: "/x402/info", price: "free" }
      },
      agents: {
        count: 3,
        engine: "NEAR AI (DeepSeek-V3.1) with verification proofs",
        coordination: "Ensue Memory Network"
      }
    }

Step 2.3: Create coordinator-agent/src/routes/x402-deliberate.ts
  - POST /x402/deliberate
  - Parse body: { proposal: string, context?: string }
  - Validate: proposal must be non-empty string, max 2000 chars
  - Generate proposalId (uuid or use existing ID pattern)
  - Format into the SAME taskConfig format the existing trigger uses:
      taskConfig = JSON.stringify({
        type: "vote",
        parameters: { proposal: body.proposal, context: body.context }
      })
  - Call the existing trigger logic:
      OPTION A (preferred): Import and call the same function /api/coordinate/trigger uses
      OPTION B (simpler): Make an internal HTTP call to POST /api/coordinate/trigger
      Choose based on what's easier given how coordinate.ts exports its logic.
      If the trigger handler is tightly coupled to req/res, use OPTION B.
  - Save to verdict-store with status: "processing" and stellarPaymentTx from x402 headers
  - Return: { proposalId, status: "processing", message: "Deliberation started. Poll /x402/verdict/{id} for results." }

  IMPORTANT: Extract the Stellar transaction hash from the x402 settlement.
  The x402 middleware may attach payment info to the request. Check:
  - req.headers for X-PAYMENT-RESPONSE or similar
  - The @x402/express docs for how to access settlement data in route handlers
  If not easily accessible, skip tx hash for now — the payment still works.

Step 2.4: Create coordinator-agent/src/routes/x402-verdict.ts
  - GET /x402/verdict/:id
  - Look up proposalId in verdict-store
  - If not found: return 404 { error: "Proposal not found" }
  - If status is "processing":
      Try to fetch latest state from Ensue:
        - Read coordination/tasks/*/status for each worker
        - Read coordination/tasks/*/result for completed workers
        - Read coordination/coordinator/tally if available
      Update verdict-store with whatever data is available
      Return current state (may be partial — show which workers have voted)
  - If status is "completed":
      Return full verdict with all votes, tally, NEAR tx, Stellar payment tx

Step 2.5: Create the x402 router (Hono sub-app)
  - Create coordinator-agent/src/routes/x402-router.ts
  - Import all three route handlers
  - Export a Hono sub-app:
      const router = new Hono();
      router.get('/info', x402InfoHandler);
      router.post('/deliberate', x402DeliberateHandler);
      router.get('/verdict/:id', x402VerdictHandler);
      export default router;

Step 2.6: Wire up verdict completion
  - The existing memory-monitor.ts already detects when all workers are done
    and tallies the result. We need the verdict-store to get updated when this happens.
  - OPTION A (preferred, non-invasive): Add a polling loop in x402-verdict.ts that
    reads from Ensue on each GET request (already described in Step 2.4).
    This means the store gets lazily updated when someone asks for the verdict.
  - OPTION B (more work): Hook into memory-monitor's tally completion callback.
    Only do this if you can add a single event emitter call without changing
    the existing tally logic.
  - Use OPTION A for the hackathon. It's simpler and doesn't touch memory-monitor.

Step 2.7: Test end-to-end (without payment — use PAYWALL_DISABLED or test manually)
  - Start the full stack: ./run-dev.sh (coordinator + 3 workers + frontend)
  - POST to /x402/deliberate with a test proposal
  - Wait ~30-60 seconds for workers to complete
  - GET /x402/verdict/:id — should show votes
  - If this works, Phase 2 is DONE
```

### Phase 3: x402 Client Demo

```
Step 3.1: Create x402-client/ directory at repo root
  - x402-client/package.json (name: "@delibera/x402-client", type: module)
  - x402-client/tsconfig.json
  - Dependencies: @x402/fetch @x402/stellar @x402/core @stellar/stellar-sdk dotenv tsx
  - Scripts: "demo": "tsx client.ts"

Step 3.2: Create x402-client/client.ts
  Based on the Stellar quickstart client pattern:
  - Load STELLAR_PRIVATE_KEY and DELIBERA_SERVER_URL from .env
  - Create x402 client with createEd25519Signer + ExactStellarScheme
  - Create x402HTTPClient

  Demo flow:
    1. Print banner: "Delibera x402 — Autonomous Governance Agent"
    2. Fetch /x402/info (free) — print service info and pricing
    3. Print: "Submitting proposal for deliberation... paying $0.01 USDC on Stellar"
    4. POST /x402/deliberate with x402 payment:
       {
         proposal: "Should the DAO allocate 50,000 USDC to fund a developer education program?",
         context: "The DAO treasury has 2M USDC. Current burn rate is 100K/month. Three worker agents with different governance perspectives will deliberate."
       }
    5. Print: "Proposal submitted! ID: {id}. Waiting for multi-agent deliberation..."
    6. Poll loop: GET /x402/verdict/:id (with x402 payment each time)
       - Wait 10 seconds between polls
       - Print progress: "Worker 1 voted... Worker 2 voted..."
       - Max 12 polls (2 minutes). If still processing, print partial results.
       NOTE: Each poll costs $0.002 USDC. For the demo, poll 3-4 times max.
       Alternative: make the first verdict call free (remove from x402 config)
       or add a free /x402/status/:id endpoint that just returns processing/completed.
    7. Print final verdict:
       - Each worker's vote and reasoning
       - Final tally and decision
       - Stellar payment transaction hash
       - NEAR on-chain transaction hash
    8. Print: "Total cost: ~$0.016 USDC on Stellar | Governance settled on NEAR"

Step 3.3: Create x402-client/.env.example
  STELLAR_PRIVATE_KEY=S...
  DELIBERA_SERVER_URL=http://localhost:3000

Step 3.4: Add to root workspace (if using pnpm workspaces)
  Or keep standalone — either way, document how to run it.

Step 3.5: Add convenience script to root package.json or Makefile
  "x402-demo": "cd x402-client && pnpm demo"
```

### Phase 4: README, Submission & Demo Video

```
Step 4.1: Update README.md (or create README-x402.md)
  Add a prominent section at the top:

  ## Delibera x402 — Paid Deliberation Oracle on Stellar

  Delibera now accepts x402 payments on Stellar. Any AI agent can:
  1. Pay $0.01 USDC → submit a governance proposal
  2. Three autonomous worker agents deliberate using NEAR AI with verification proofs
  3. Coordinator tallies votes, settles decision on NEAR blockchain
  4. Pay $0.002 USDC → retrieve the full signed verdict

  No API keys. No subscriptions. No human in the loop.

  ### Architecture
  - **Payment layer**: Stellar (USDC via x402 protocol)
  - **Coordination layer**: Ensue Memory Network (shared agent state)
  - **Deliberation engine**: 3 NEAR AI worker agents (DeepSeek-V3.1 + verification proofs)
  - **Governance settlement**: NEAR testnet (yield/resume smart contract)
  - **Encrypted persistence**: Storacha + Lit Protocol

  ### Quick Start (x402 Demo)
  Prerequisites: Node.js 22+, pnpm, two Stellar testnet wallets funded with USDC

  ```bash
  # Start the full Delibera stack
  ./run-dev.sh

  # In another terminal, run the x402 client
  cd x402-client
  cp .env.example .env  # add your Stellar testnet secret key
  pnpm install
  pnpm demo
  ```

  ### API Reference (x402 Endpoints)
  | Endpoint | Price | Description |
  |---|---|---|
  | GET /x402/info | Free | Service discovery, pricing, agent info |
  | POST /x402/deliberate | $0.01 USDC | Submit proposal for multi-agent deliberation |
  | GET /x402/verdict/:id | $0.002 USDC | Retrieve full verdict with agent votes |

  ### Existing Endpoints (Internal, No Payment)
  | Endpoint | Description |
  |---|---|
  | POST /api/coordinate/trigger | Trigger deliberation (internal) |
  | GET /api/coordinate/status | Current coordination status |
  | GET /api/coordinate/workers | Registered worker list |

```

---

## Wallet Setup (Manual — Before Claude Code)

1. **Server wallet** (receives x402 payments):
   - https://lab.stellar.org/account/create → generate keypair
   - Fund with XLM at https://lab.stellar.org/account/fund
   - Add USDC trustline, sign and submit
   - Save public key as `STELLAR_SERVER_ADDRESS` in coordinator .env

2. **Client wallet** (pays for deliberation in the demo):
   - Create second keypair
   - Fund with XLM, add USDC trustline
   - Get testnet USDC from https://faucet.circle.com (Stellar Testnet)
   - Save secret key as `STELLAR_PRIVATE_KEY` in x402-client/.env

3. **Existing keys** (already configured):
   - NEAR accounts, Ensue API keys, Storacha keys — all stay as-is

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| x402 middleware conflicts with existing Hono middleware | Mount x402 middleware ONLY on /x402/* routes using `app.use('/x402/*', ...)` Hono path scoping, not globally |
| The existing trigger function is tightly coupled to req/res | Use internal HTTP call (fetch to localhost:3000/api/coordinate/trigger) as fallback |
| Workers take too long, client times out | The client polls. Show partial results. The demo can show "2 of 3 workers voted" as progress |
| x402 packages conflict with existing package versions | Install in coordinator-agent only, test immediately. If version conflicts, use exact versions from Stellar quickstart |
| OZ Channels facilitator down | Already the primary choice. Fallback: `https://www.x402.org/facilitator` (Coinbase) |
| Ensue API is slow or rate-limited | Already handled by the existing polling logic — no change needed |

---

## Success Criteria

- [ ] Existing V1 flow still works: `./run-dev.sh` + `/api/coordinate/trigger`
- [ ] `GET /x402/info` returns service discovery JSON (free, no payment)
- [ ] `POST /x402/deliberate` returns HTTP 402 with Stellar payment headers
- [ ] After x402 payment, proposal triggers the real worker deliberation cycle
- [ ] Workers vote independently via NEAR AI (visible in logs)
- [ ] `GET /x402/verdict/:id` returns worker votes + tally after completion
- [ ] Stellar USDC transaction visible on https://stellar.expert
- [ ] NEAR governance transaction visible on explorer
- [ ] x402-client demo runs end-to-end autonomously
- [ ] Demo video shows both chains (Stellar payment + NEAR governance)
- [ ] Submitted on DoraHacks before April 13, 17:00 UTC

---

## What NOT To Build

- ❌ Zama FHE blind voting — not started, not relevant to this hackathon
- ❌ Flow VRF jury selection — orthogonal
- ❌ New frontend pages — CLI demo is sufficient
- ❌ Stripe MPP — early access only, not needed for Stellar hackathon
- ❌ Docker / deployment — local demo is fine
- ❌ Database for verdicts — in-memory store, populated from Ensue reads
- ❌ Agent wallets on Stellar for workers — overkill for 3 days
- ❌ Refactoring existing code — ADDITIVE ONLY

---

## The Pitch

> Delibera is a paid deliberation oracle running on two blockchains.
> You pay USDC on Stellar via x402. Three autonomous agents deliberate
> using NEAR AI with shared memory on Ensue. The verdict settles
> on-chain via NEAR smart contracts. No API keys. No human approval.
> Just pay and get a governance decision — backed by real multi-agent
> coordination, not a single LLM call behind a paywall.
