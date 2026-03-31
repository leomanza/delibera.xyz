# Delibera Protocol Documentation Site — Content Plan

> **Goal:** Populate `docs/content/` with comprehensive MDX pages covering the full Delibera protocol, all stack components (NEAR, Ensue, Storacha, Phala, Lit, NEAR AI, Zama), guides, and API reference. The docs site framework is already built — this plan is content-only.

**Site:** `docs/` (Next.js 16, MDX via next-mdx-remote, Shiki highlighting, matrix-green theme)
**Content dir:** `docs/content/<section>/<page>.mdx`
**Navigation order** (hardcoded in `content.ts`): overview, architecture, contracts, identity, guides, api, near-ai, security, tech-stack, roadmap
**Source material:** `doc/reference/CLAUDE.md`, `doc/reference/ARCHITECTURE.md`, `doc/worker-api-spec.md`, `doc/storacha/`, contract source code, existing README files

---

## Sections & Pages

### 1. `overview/` — What is Delibera

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Overview | What Delibera is, why it exists, 3-paragraph elevator pitch, key features list, link to architecture |
| `getting-started.mdx` | Getting Started | Prerequisites, clone repo, env vars, `run-dev.sh`, verify health endpoints |
| `how-it-works.mdx` | How It Works | ELI5 flow: proposal created -> workers deliberate -> private votes -> aggregate on-chain. Mermaid diagram |

- [ ] Create `docs/content/overview/meta.json`
- [ ] Create `docs/content/overview/index.mdx`
- [ ] Create `docs/content/overview/getting-started.mdx`
- [ ] Create `docs/content/overview/how-it-works.mdx`

### 2. `architecture/` — System Design

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Architecture | Layer diagram (NEAR, Coordinator, Workers, Ensue, Storacha, AI), component responsibilities |
| `coordinator.mdx` | Coordinator | Role, proposal lifecycle, worker discovery, task dispatch, tally aggregation, Phala TEE |
| `workers.mdx` | Workers | Types (managed/external), DID identity, polling loop, deliberation, persistent memory |
| `permissionless.mdx` | Permissionless Protocol | Model A: registry contract, self-registration, 0.1 NEAR deposit, coordinator discovery |

- [ ] Create `docs/content/architecture/meta.json`
- [ ] Create `docs/content/architecture/index.mdx`
- [ ] Create `docs/content/architecture/coordinator.mdx`
- [ ] Create `docs/content/architecture/workers.mdx`
- [ ] Create `docs/content/architecture/permissionless.mdx`

### 3. `contracts/` — NEAR Smart Contracts

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Smart Contracts | Overview of on-chain components, contract addresses (testnet) |
| `registry.mdx` | Registry Contract | `register_coordinator`, `register_worker`, `get_workers_for_coordinator`, storage keys, deposit mechanics |
| `coordinator-contract.mdx` | Coordinator Contract | `create_proposal`, `submit_result`, voting config, quorum, proposal states, yield/resume |
| `development.mdx` | Contract Development | Rust setup, near-sdk 5.7.0 patterns (`#[near(contract_state)]`), WASM build (`-Z build-std`), `wasm-opt`, deploy |

- [ ] Create `docs/content/contracts/meta.json`
- [ ] Create `docs/content/contracts/index.mdx`
- [ ] Create `docs/content/contracts/registry.mdx`
- [ ] Create `docs/content/contracts/coordinator-contract.mdx`
- [ ] Create `docs/content/contracts/development.mdx`

### 4. `identity/` — Agent Identity & Memory

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Identity System | DID:key model, ed25519, `STORACHA_AGENT_PRIVATE_KEY`, identity derivation |
| `persistent-memory.mdx` | Persistent Memory | Ensue as primary (AES-256-GCM encrypted), Storacha as backup (Lit threshold encryption), read/write order |
| `storacha.mdx` | Storacha Integration | Spaces, UCAN delegation, per-worker spaces, `@storacha/client` ESM import, CID archival |
| `ensue.mdx` | Ensue Network | JSON-RPC 2.0 over SSE, memory keys, `create_memory`/`update_memory`/`read_memory`, encryption layer |

- [ ] Create `docs/content/identity/meta.json`
- [ ] Create `docs/content/identity/index.mdx`
- [ ] Create `docs/content/identity/persistent-memory.mdx`
- [ ] Create `docs/content/identity/storacha.mdx`
- [ ] Create `docs/content/identity/ensue.mdx`

### 5. `guides/` — How-To Guides

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Guides | Index of guides with descriptions |
| `join-swarm.mdx` | Join the Swarm | `skill.md` walkthrough for external workers — clone, configure, deploy, register, verify |
| `deploy-coordinator.mdx` | Deploy a Coordinator | One-click flow via UI, or manual: contract deploy, Phala CVM, env config |
| `deploy-worker.mdx` | Deploy a Managed Worker | One-click flow via `/buy/worker`, Phala TEE provisioning, key download |
| `voting-flow.mdx` | Voting Flow (E2E) | Proposal creation -> worker polling -> AI deliberation -> vote submission -> tally -> on-chain result. Include Mermaid sequence diagram |
| `local-development.mdx` | Local Development | `LOCAL_MODE`, `run-dev.sh`, multiple workers, frontend, protocol-api, testing proposals |

- [ ] Create `docs/content/guides/meta.json`
- [ ] Create `docs/content/guides/index.mdx`
- [ ] Create `docs/content/guides/join-swarm.mdx`
- [ ] Create `docs/content/guides/deploy-coordinator.mdx`
- [ ] Create `docs/content/guides/deploy-worker.mdx`
- [ ] Create `docs/content/guides/voting-flow.mdx`
- [ ] Create `docs/content/guides/local-development.mdx`

### 6. `api/` — API Reference

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | API Reference | Overview of all APIs (worker HTTP, coordinator HTTP, protocol-api, contract view methods) |
| `worker-api.mdx` | Worker API | `GET /` (health), `POST /api/task/execute`, `POST /api/task/status`, request/response schemas. Use `<ApiMethod>` component |
| `coordinator-api.mdx` | Coordinator API | Endpoints: proposals CRUD, worker management, task dispatch, tally. Use `<ApiMethod>` |
| `protocol-api.mdx` | Protocol API (Provisioning) | `/api/provision/coordinator`, `/api/provision/worker`, `/api/provision/external-worker`, `/api/registry/*` |
| `ensue-api.mdx` | Ensue Memory API | JSON-RPC methods: `create_memory`, `update_memory`, `read_memory`, `list_keys`, SSE transport |

- [ ] Create `docs/content/api/meta.json`
- [ ] Create `docs/content/api/index.mdx`
- [ ] Create `docs/content/api/worker-api.mdx`
- [ ] Create `docs/content/api/coordinator-api.mdx`
- [ ] Create `docs/content/api/protocol-api.mdx`
- [ ] Create `docs/content/api/ensue-api.mdx`

### 7. `near-ai/` — NEAR AI Integration

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | NEAR AI | What NEAR AI provides, `cloud-api.near.ai/v1`, model (DeepSeek-V3.1), authentication |
| `tool-calling.mdx` | Tool Calling | `dao_vote` tool schema, system prompt construction, manifesto injection, reasoning extraction |
| `verification.mdx` | Verification & Proofs | `GET /v1/signature/{chat_id}`, ECDSA proof, chat_id tracking, trustless verification |

- [ ] Create `docs/content/near-ai/meta.json`
- [ ] Create `docs/content/near-ai/index.mdx`
- [ ] Create `docs/content/near-ai/tool-calling.mdx`
- [ ] Create `docs/content/near-ai/verification.mdx`

### 8. `security/` — Security & Privacy

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Security Model | Privacy guarantees overview, threat model, trust assumptions |
| `tee.mdx` | TEE (Phala Network) | What TEE provides, Phala CVM, attestation, docker compose requirements, `dstack.sock` |
| `encryption.mdx` | Encryption | AES-256-GCM (Ensue), Lit threshold encryption (Storacha), key derivation from `STORACHA_AGENT_PRIVATE_KEY` |
| `privacy.mdx` | Vote Privacy | Individual reasoning private (Ensue only), aggregate tally on-chain, no coordinator access to individual votes |

- [ ] Create `docs/content/security/meta.json`
- [ ] Create `docs/content/security/index.mdx`
- [ ] Create `docs/content/security/tee.mdx`
- [ ] Create `docs/content/security/encryption.mdx`
- [ ] Create `docs/content/security/privacy.mdx`

### 9. `tech-stack/` — Technology Stack

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Tech Stack | Full stack diagram with links to each technology page |
| `near.mdx` | NEAR Protocol | Testnet, contracts (Rust, near-sdk 5.7.0), RPC (`test.rpc.fastnear.com`), accounts, deposits |
| `storacha.mdx` | Storacha | IPFS + Filecoin, spaces, DIDs, UCAN, `@storacha/client`, content-addressed storage |
| `phala.mdx` | Phala Network | TEE, CVM, Docker compose, `linux/amd64`, endpoint polling, `dstack.sock`, attestation |
| `lit.mdx` | Lit Protocol | Threshold encryption, `nagaDev` network, access control, `@storacha/encrypt-upload-client` |
| `ensue.mdx` | Ensue Network | Shared state layer, JSON-RPC 2.0, SSE, structured content, memory operations |
| `zama.mdx` | Zama (FHE) | Fully homomorphic encryption for blind voting (Phase 3 — planned), TFHE scheme |

- [ ] Create `docs/content/tech-stack/meta.json`
- [ ] Create `docs/content/tech-stack/index.mdx`
- [ ] Create `docs/content/tech-stack/near.mdx`
- [ ] Create `docs/content/tech-stack/storacha.mdx`
- [ ] Create `docs/content/tech-stack/phala.mdx`
- [ ] Create `docs/content/tech-stack/lit.mdx`
- [ ] Create `docs/content/tech-stack/ensue.mdx`
- [ ] Create `docs/content/tech-stack/zama.mdx`

### 10. `roadmap/` — Roadmap & Status

| File | Title | Content |
|------|-------|---------|
| `index.mdx` | Roadmap | Phase timeline with status: Phase 1 (Identity) DONE, Phase 2 (Encrypted Persistence) DONE, Phase 2.5 (Stabilization) DONE, Phase 2.6 (Private Memory) DONE, Phase 3 (FHE Blind Voting) PLANNED, Phase 4 (Jury Selection & Archival) PLANNED |
| `changelog.mdx` | Changelog | Key milestones: permissionless protocol, per-worker spaces, E2E verified proposals, skill.md |

- [ ] Create `docs/content/roadmap/meta.json`
- [ ] Create `docs/content/roadmap/index.mdx`
- [ ] Create `docs/content/roadmap/changelog.mdx`

---

## Implementation Order

Execute sections in this order (most useful content first):

1. **overview/** — Landing + getting started (3 pages)
2. **architecture/** — System understanding (4 pages)
3. **guides/** — Practical how-tos (6 pages)
4. **api/** — Reference (5 pages)
5. **contracts/** — Smart contract docs (4 pages)
6. **identity/** — Identity deep-dive (4 pages)
7. **near-ai/** — AI integration (3 pages)
8. **security/** — Security model (4 pages)
9. **tech-stack/** — Stack reference (7 pages)
10. **roadmap/** — Status & future (2 pages)

**Total: 42 MDX pages + 10 meta.json files**

---

## Content Guidelines

- Use existing `doc/` material as source — don't invent, extract and restructure
- Every page needs frontmatter: `title`, `description`, `order`
- Use `<Callout>` for warnings/tips, `<ApiMethod>` for endpoints, `<MermaidDiagram>` for flows
- Use `<Tabs>` for multi-option instructions (e.g., Railway vs Fly.io)
- Code blocks: use appropriate language tags (`rust`, `typescript`, `bash`, `json`)
- Keep pages focused — one concept per page, link between pages
- Contract addresses: always show testnet values with a callout noting testnet-only
- Mermaid diagrams for: voting flow, architecture layers, proposal lifecycle, identity derivation

---

## Verification

After all content is created:
- [ ] `cd docs && npm install && npm run build` — builds without errors
- [ ] Every section appears in sidebar navigation
- [ ] All internal links resolve (no 404s)
- [ ] Code blocks render with syntax highlighting
- [ ] Mermaid diagrams render
- [ ] `<ApiMethod>` components display correctly
- [ ] Mobile sidebar works
- [ ] TOC generates for pages with headings
