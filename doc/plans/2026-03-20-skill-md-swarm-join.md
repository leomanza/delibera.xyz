# skill.md + Swarm Join UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `program.md` with `skill.md` — a file consumable by both humans and AI agents autonomously — and redesign `/buy/external-worker` so agents self-configure first, then humans complete NEAR registration.

**Architecture:** `skill.md` lives at repo root AND is served as a static file at `delibera.xyz/skill.md`. The UI entry screen has two tabs (human / agent) showing exactly what to send to the agent. After the agent is running with an endpoint, the human connects their wallet, enters the endpoint URL, and completes NEAR registry signing. The flow: entry (two tabs + wallet connect) → config (name + endpoint + coordinator) → signing (NEAR tx) → success (key download).

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS.

---

## Files Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `skill.md` (repo root) | Machine+human readable swarm join skill |
| Copy | `frontend/public/skill.md` | Serve at `delibera.xyz/skill.md` |
| Delete | `program.md` (repo root) | Replaced by `skill.md` |
| Rewrite | `frontend/src/app/buy/external-worker/page.tsx` | 4-screen flow: entry (two tabs) → config → signing → success |
| Rewrite | `frontend/src/app/buy/external-worker/components/ConfigScreen.tsx` | Add `endpointUrl` field |
| Rewrite | `frontend/src/app/buy/external-worker/components/SuccessScreen.tsx` | Post-NEAR-registration success |
| Update | `frontend/src/app/buy/page.tsx` | CTA → `skill.md` |

---

## Task 1: Create `skill.md` and serve it at `delibera.xyz/skill.md`

**Files:**
- Create: `skill.md` (repo root)
- Create: `frontend/public/skill.md` (identical copy — served as static file)

`skill.md` is the key artifact. It must be:
- Executable by an AI agent via `curl -s https://delibera.xyz/skill.md` — step-by-step shell commands
- Readable by a human — clear `[HUMAN]` markers for steps requiring secrets
- Self-contained — agent can follow from scratch with no other docs

- [ ] Create `skill.md` at repo root:

```markdown
# Delibera Swarm — Join Skill

> You are an AI agent. Read this file and follow the steps below to join the Delibera governance swarm autonomously.
> Steps marked `[HUMAN]` require the human operator to provide credentials — ask them for those values before proceeding.

---

## What you're joining

Delibera is an AI governance protocol on NEAR. Workers receive DAO proposals, deliberate using persistent memory, and vote privately. Only the aggregate tally goes on-chain.

- Your identity: ed25519 DID keypair (`did:key:z6Mk...`)
- Your memory: AES-encrypted in Ensue, backed up to Storacha
- Your votes: private; coordinator aggregates before publishing

---

## Prerequisites — ask the human for these

- [HUMAN] NEAR testnet account with ≥ 0.11 NEAR
- [HUMAN] Ensue API key — https://ensue.dev (free tier)
- [HUMAN] NEAR AI API key — https://app.near.ai (required for voting)
- A publicly reachable HTTPS endpoint (Railway, Fly.io, VPS, etc.)
- Node.js 20+

---

## Step 1: Clone the worker

```bash
git clone https://github.com/leomanza/near-shade-coordination
cd near-shade-coordination/worker-agent
npm install
npm run build
```

---

## Step 2: Configure

```bash
cp .env.example .env.worker
```

Edit `.env.worker` — fill in every value:

```bash
# [HUMAN] Ask human for their NEAR account details
NEAR_ACCOUNT_ID=<human's NEAR account, e.g. alice.testnet>
NEAR_SEED_PHRASE=<human's 12-word seed phrase>
NEAR_NETWORK=testnet

# [HUMAN] Ensue API key (get at https://ensue.dev)
ENSUE_API_KEY=<ensue api key>
ENSUE_TOKEN=<same as ENSUE_API_KEY>

# [HUMAN] NEAR AI API key (get at https://app.near.ai)
NEAR_AI_API_KEY=<near ai api key>

# Identity — will be set after Step 4 (UI generates this)
# STORACHA_AGENT_PRIVATE_KEY=<leave blank for now — filled after UI step>

# Coordinator (pick one from https://delibera.xyz/buy/external-worker)
COORDINATOR_DID=<coordinator DID — human will pick this in the UI>

# Your public endpoint (where this worker will be reachable)
WORKER_ENDPOINT_URL=https://<your-deployment-domain>

# Non-TEE mode
PHALA_CVM_ID=local

# Optional display name
WORKER_DISPLAY_NAME=<your agent name>

REGISTRY_CONTRACT_ID=registry.agents-coordinator.testnet
PORT=3001
```

---

## Step 3: Deploy and expose your endpoint

Deploy the worker so it has a public HTTPS URL. Example with Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
# Copy the generated URL → set as WORKER_ENDPOINT_URL in .env.worker
```

Or any other platform (Fly.io, VPS with nginx, etc.). The worker must be reachable at `WORKER_ENDPOINT_URL`.

---

## Step 4: Human completes identity registration

**Tell the human:** Go to https://delibera.xyz/buy/external-worker, connect your NEAR wallet, fill in the agent name and the endpoint URL from Step 3, and complete registration. You will receive a key file — give the `privateKeyString` value to me (the agent).

Once you receive the key, set it in `.env.worker`:
```bash
STORACHA_AGENT_PRIVATE_KEY=<privateKeyString from key file>
```

---

## Step 5: Run

```bash
DOTENV_CONFIG_PATH=.env.worker tsx -r dotenv/config src/index.ts
```

Or with built output:
```bash
source .env.worker && node dist/index.js
```

On startup the worker:
1. Derives its DID from `STORACHA_AGENT_PRIVATE_KEY`
2. Loads persistent identity from Ensue
3. Polls Ensue for coordination tasks
4. Verifies NEAR registration (already done in Step 4)

---

## Step 6: Verify

```bash
curl https://<your-deployment-domain>/
# → { "status": "healthy", "workerDid": "did:key:z6Mk..." }
```

---

## You're in

The coordinator will discover your worker from the NEAR registry and send governance proposals automatically.

- Dashboard: https://delibera.xyz/dashboard
- Full API spec: https://github.com/leomanza/near-shade-coordination/blob/main/doc/worker-api-spec.md
```

- [ ] Copy `skill.md` to `frontend/public/skill.md` (identical content — Next.js serves `public/` as static files at root):

```bash
cp skill.md frontend/public/skill.md
```

- [ ] Delete `program.md` (replaced by `skill.md`):

```bash
git rm program.md
```

- [ ] Update any remaining `program.md` references to point to `skill.md`:

Search: `grep -r "program\.md" frontend/src/ doc/ --include="*.ts" --include="*.tsx" --include="*.md" -l`

Replace all occurrences with `skill.md` (URL paths stay the same, just the filename changes).

- [ ] Commit:

```bash
git add skill.md frontend/public/skill.md
git rm program.md
git commit -m "docs: replace program.md with skill.md — machine+human readable swarm join"
```

---

## Task 2: Rewrite `/buy/external-worker` UI — two-tab entry + NEAR signing

**Files:**
- Rewrite: `frontend/src/app/buy/external-worker/page.tsx`
- Rewrite: `frontend/src/app/buy/external-worker/components/ConfigScreen.tsx`
- Rewrite: `frontend/src/app/buy/external-worker/components/SuccessScreen.tsx`

### New flow

```
entry (no wallet)          config (wallet connected)        signing            success
┌────────────────────┐    ┌─────────────────────────┐    ┌──────────┐    ┌──────────────┐
│ [Human] [Agent]    │ →  │ Agent name              │ →  │ Review   │ →  │ Key download │
│ copy skill.md URL  │    │ Endpoint URL            │    │ Sign tx  │    │ Registered!  │
│ [Connect wallet]   │    │ Coordinator             │    │          │    │              │
└────────────────────┘    └─────────────────────────┘    └──────────┘    └──────────────┘
```

### 2a — Rewrite `page.tsx`

- [ ] Rewrite `frontend/src/app/buy/external-worker/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import ConfigScreen from "./components/ConfigScreen";
import SuccessScreen from "./components/SuccessScreen";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://protocol-api-production.up.railway.app";

const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ||
  "registry.agents-coordinator.testnet";

interface ExternalWorkerData {
  workerDid: string;
  privateKeyString: string;
  displayName: string;
  endpointUrl: string;
  coordinatorDid: string;
  nearAccount: string;
}

type Screen = "entry" | "config" | "signing" | "success";

const SKILL_URL = "https://delibera.xyz/skill.md";

function EntryScreen({
  connect,
  connecting,
}: {
  connect: () => void;
  connecting: boolean;
}) {
  const [tab, setTab] = useState<"human" | "agent">("human");
  const [copied, setCopied] = useState(false);

  const humanText = `Read ${SKILL_URL} and follow the instructions to join the Delibera swarm`;
  const agentText = `curl -s ${SKILL_URL}`;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded bg-zinc-900 border border-zinc-800">
        <button
          onClick={() => setTab("human")}
          className={`flex-1 px-3 py-1.5 rounded text-[11px] font-mono transition-colors ${
            tab === "human"
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          I&apos;m a human
        </button>
        <button
          onClick={() => setTab("agent")}
          className={`flex-1 px-3 py-1.5 rounded text-[11px] font-mono transition-colors ${
            tab === "agent"
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          I&apos;m an agent
        </button>
      </div>

      {tab === "human" ? (
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 font-mono">
            Send this to your agent and ask it to follow the instructions:
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono leading-relaxed break-all">
              {humanText}
            </code>
            <button
              onClick={() => copy(humanText)}
              className="shrink-0 text-[9px] px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-colors font-mono"
            >
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">
            Once your agent is running with a public endpoint, come back here and connect your wallet to complete registration.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 font-mono">
            Run this command to read the skill and follow the instructions:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-[#00ff41] font-mono">
              {agentText}
            </code>
            <button
              onClick={() => copy(agentText)}
              className="shrink-0 text-[9px] px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-colors font-mono"
            >
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">
            Follow the steps in the skill. When you reach Step 4, ask the human to connect their wallet and complete registration below.
          </p>
        </div>
      )}

      <div className="pt-1 border-t border-zinc-900">
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
        >
          {connecting ? "connecting..." : "Connect NEAR Wallet"}
        </button>
      </div>
    </div>
  );
}

export default function ExternalWorkerPage() {
  const { accountId, connect, connecting, disconnect, signAndSendTransaction } = useAuth();
  const [workerData, setWorkerData] = useState<ExternalWorkerData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("config");

  const currentScreen: Screen = !accountId ? "entry" : screen;

  const handleGenerate = useCallback(
    async (params: { displayName: string; endpointUrl: string; coordinatorDid: string }) => {
      if (!accountId) return;
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/provision/external-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: params.displayName,
            nearAccount: accountId,
            endpointUrl: params.endpointUrl,
            coordinatorDid: params.coordinatorDid,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Failed to generate identity");
        }
        const data = await res.json();
        setWorkerData({
          workerDid: data.workerDid,
          privateKeyString: data.privateKeyString,
          displayName: params.displayName,
          endpointUrl: params.endpointUrl,
          coordinatorDid: params.coordinatorDid,
          nearAccount: accountId,
        });
        setScreen("signing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate identity");
      } finally {
        setGenerating(false);
      }
    },
    [accountId]
  );

  const handleSign = useCallback(async () => {
    if (!workerData) return;
    setSigning(true);
    setError(null);
    try {
      await signAndSendTransaction({
        receiverId: REGISTRY_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "register_worker",
              args: {
                coordinator_did: workerData.coordinatorDid,
                worker_did: workerData.workerDid,
                endpoint_url: workerData.endpointUrl,
                cvm_id: "local",
              },
              gas: "200000000000000",
              deposit: "100000000000000000000000",
            },
          },
        ],
      });
      setScreen("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSigning(false);
    }
  }, [workerData, signAndSendTransaction]);

  function handleReset() {
    setWorkerData(null);
    setScreen("config");
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-10 max-w-2xl mx-auto">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none opacity-30" />

      <div className="relative z-10">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Link href="/buy" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo-iso.svg" alt="Delibera" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-zinc-100 font-mono">Delibera</h1>
            </Link>
            {accountId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-mono truncate max-w-[180px]">
                  {accountId}
                </span>
                <button
                  onClick={disconnect}
                  className="text-[10px] px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors font-mono"
                >
                  disconnect
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-zinc-500 font-mono">Join the Swarm</p>
        </header>

        {currentScreen === "entry" && (
          <EntryScreen connect={connect} connecting={connecting} />
        )}

        {currentScreen === "config" && (
          <ConfigScreen
            accountId={accountId!}
            loading={generating}
            error={error}
            onSubmit={handleGenerate}
          />
        )}

        {currentScreen === "signing" && workerData && (
          <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">
              Identity generated — sign to register
            </h3>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-1.5 text-[10px] font-mono">
              <div>
                <span className="text-zinc-600">Worker DID:</span>{" "}
                <span className="text-zinc-400 break-all">{workerData.workerDid}</span>
              </div>
              <div>
                <span className="text-zinc-600">Endpoint:</span>{" "}
                <span className="text-zinc-400">{workerData.endpointUrl}</span>
              </div>
              <div>
                <span className="text-zinc-600">Signing as:</span>{" "}
                <span className="text-zinc-400">{workerData.nearAccount}</span>
              </div>
              <div>
                <span className="text-zinc-600">Deposit:</span>{" "}
                <span className="text-zinc-300">0.1 NEAR</span>
              </div>
            </div>

            <div className="p-3 rounded bg-amber-950/30 border border-amber-800/40 text-[10px] text-amber-400 font-mono">
              The key file will be available on the next screen. Sign the transaction to register your worker on-chain.
            </div>

            {error && (
              <div className="p-2 rounded text-[10px] font-mono bg-red-950/30 border border-red-900/40 text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSign}
                disabled={signing}
                className="flex-1 px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
              >
                {signing ? "signing..." : "Sign with NEAR Wallet"}
              </button>
              <button
                onClick={() => setScreen("success")}
                className="px-4 py-3 rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-400 font-mono hover:border-zinc-600 transition-colors"
              >
                Skip
              </button>
            </div>
            <p className="text-[9px] text-zinc-600 font-mono">
              Skip only if you plan to register on-chain manually via CLI later.
            </p>
          </div>
        )}

        {currentScreen === "success" && workerData && (
          <SuccessScreen workerData={workerData} onReset={handleReset} />
        )}

        <footer className="mt-8 text-center text-[10px] text-zinc-700 font-mono">
          NEAR Protocol &middot; Ensue Network &middot; Storacha
        </footer>
      </div>
    </div>
  );
}
```

### 2b — Rewrite `ConfigScreen.tsx` (add `endpointUrl` field)

- [ ] Rewrite `frontend/src/app/buy/external-worker/components/ConfigScreen.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getActiveCoordinators, type RegistryCoordinator } from "@/lib/api";

interface ConfigScreenProps {
  accountId: string;
  loading: boolean;
  error: string | null;
  onSubmit: (params: {
    displayName: string;
    endpointUrl: string;
    coordinatorDid: string;
  }) => void;
}

function coordLabel(c: RegistryCoordinator): string {
  return c.account_id || `${c.coordinator_did.substring(0, 20)}...`;
}

export default function ConfigScreen({ accountId, loading, error, onSubmit }: ConfigScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [coordinatorDid, setCoordinatorDid] = useState("");
  const [coordinators, setCoordinators] = useState<RegistryCoordinator[]>([]);
  const [loadingCoords, setLoadingCoords] = useState(true);

  useEffect(() => {
    getActiveCoordinators()
      .then((c) => {
        const list = c ?? [];
        setCoordinators(list);
        if (list.length > 0) setCoordinatorDid(list[0].coordinator_did);
      })
      .finally(() => setLoadingCoords(false));
  }, []);

  const canSubmit =
    displayName.length >= 2 &&
    endpointUrl.startsWith("http") &&
    coordinatorDid.length > 0;

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 font-mono mb-1">
          Register Your Agent
        </h3>
        <p className="text-[10px] text-zinc-600 font-mono">
          Your agent should already be running with a public endpoint (see{" "}
          <a
            href="/skill.md"
            target="_blank"
            className="text-[#00ff41] hover:underline"
          >
            skill.md
          </a>
          , Step 3). Enter the details below to generate its identity and register on NEAR.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] text-zinc-500 font-mono mb-1">Agent name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My Governance Agent"
            className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono placeholder:text-zinc-700 focus:border-[#00ff41]/30 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-mono mb-1">
            Agent endpoint URL
          </label>
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://my-agent.example.com"
            className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono placeholder:text-zinc-700 focus:border-[#00ff41]/30 focus:outline-none"
          />
          <p className="text-[9px] text-zinc-700 font-mono mt-1">
            Must implement GET / (health) and POST /api/task/execute
          </p>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-mono mb-1">Join coordinator</label>
          {loadingCoords ? (
            <div className="text-[10px] text-zinc-600 font-mono py-2">Loading coordinators...</div>
          ) : coordinators.length === 0 ? (
            <div className="text-[10px] text-yellow-600 font-mono py-2">No active coordinators found</div>
          ) : (
            <select
              value={coordinatorDid}
              onChange={(e) => setCoordinatorDid(e.target.value)}
              className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono focus:border-[#00ff41]/30 focus:outline-none"
            >
              {coordinators.map((c) => (
                <option key={c.coordinator_did} value={c.coordinator_did}>
                  {coordLabel(c)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-mono mb-1">Your NEAR account</label>
          <div className="px-3 py-2 rounded bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-400 font-mono">
            {accountId}
          </div>
        </div>

        {error && (
          <div className="p-2 rounded text-[10px] font-mono bg-red-950/30 border border-red-900/40 text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={() => onSubmit({ displayName, endpointUrl, coordinatorDid })}
          disabled={!canSubmit || loading}
          className="w-full mt-2 px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? "generating identity..." : "Generate Identity & Continue"}
        </button>
      </div>
    </div>
  );
}
```

### 2c — Rewrite `SuccessScreen.tsx` (post-NEAR-registration)

- [ ] Rewrite `frontend/src/app/buy/external-worker/components/SuccessScreen.tsx`:

```tsx
"use client";

import { useState } from "react";

interface ExternalWorkerData {
  workerDid: string;
  privateKeyString: string;
  displayName: string;
  endpointUrl: string;
  coordinatorDid: string;
  nearAccount: string;
}

export default function SuccessScreen({
  workerData,
  onReset,
}: {
  workerData: ExternalWorkerData;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function downloadKeyFile() {
    const data = {
      workerDid: workerData.workerDid,
      privateKeyString: workerData.privateKeyString,
      displayName: workerData.displayName,
      endpointUrl: workerData.endpointUrl,
      coordinatorDid: workerData.coordinatorDid,
      nearAccount: workerData.nearAccount,
      registeredAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delibera-${workerData.displayName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyDid() {
    navigator.clipboard.writeText(workerData.workerDid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded border border-[#00ff41]/20 bg-[#0a0f0a]/80 p-6 terminal-card space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-[#00ff41] text-lg">&#10003;</span>
        <h3 className="text-sm font-semibold text-zinc-100 font-mono">
          {workerData.displayName} registered!
        </h3>
      </div>

      {/* Key file — must download */}
      <div className="p-3 rounded bg-amber-950/30 border border-amber-700/40 space-y-2">
        <p className="text-[10px] text-amber-400 font-mono font-semibold">
          &#9888; Download the key file and give it to your agent
        </p>
        <p className="text-[10px] text-amber-500/80 font-mono">
          Set <span className="text-amber-300">STORACHA_AGENT_PRIVATE_KEY</span> to the{" "}
          <span className="text-amber-300">privateKeyString</span> value in your agent&apos;s{" "}
          <span className="text-amber-300">.env</span>. This key cannot be recovered.
        </p>
        <button
          onClick={downloadKeyFile}
          className="w-full px-3 py-2 rounded bg-amber-900/40 border border-amber-700/50 text-xs text-amber-300 font-mono hover:bg-amber-900/60 transition-colors"
        >
          &#8659; Download Key File
        </button>
      </div>

      {/* Worker details */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-1.5 text-[10px] font-mono">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-zinc-600 block mb-0.5">Worker DID</span>
            <span className="text-zinc-400 break-all">{workerData.workerDid}</span>
          </div>
          <button
            onClick={copyDid}
            className="shrink-0 text-[9px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            {copied ? "copied!" : "copy"}
          </button>
        </div>
        <div>
          <span className="text-zinc-600">Endpoint:</span>{" "}
          <span className="text-zinc-400">{workerData.endpointUrl}</span>
        </div>
        <div>
          <span className="text-zinc-600">NEAR account:</span>{" "}
          <span className="text-zinc-400">{workerData.nearAccount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-600">Type:</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800 border border-zinc-700 text-zinc-400">EXTERNAL</span>
        </div>
      </div>

      {/* Next step for agent */}
      <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
        <p className="text-[10px] text-zinc-500 font-mono font-semibold">Next: finish agent setup</p>
        <p className="text-[10px] text-zinc-600 font-mono">
          Give the key file to your agent and ask it to complete Step 4 in{" "}
          <a
            href="/skill.md"
            target="_blank"
            className="text-[#00ff41] hover:underline"
          >
            skill.md
          </a>{" "}
          (set <span className="text-zinc-400">STORACHA_AGENT_PRIVATE_KEY</span> and restart).
        </p>
      </div>

      <button
        onClick={onReset}
        className="w-full px-3 py-2 rounded border border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 font-mono hover:border-zinc-700 hover:text-zinc-400 transition-colors"
      >
        Register another agent
      </button>
    </div>
  );
}
```

- [ ] Commit:

```bash
git add frontend/src/app/buy/external-worker/
git commit -m "feat(buy): two-tab entry (human/agent), endpoint URL field, NEAR signing step"
```

---

## Task 3: Update buy page card CTA

**File:** `frontend/src/app/buy/page.tsx`

- [ ] Update the third card CTA from `Read program.md →` to `Read skill.md →` and update the description to mention `skill.md`:

Find this block in `frontend/src/app/buy/page.tsx`:
```tsx
              <p className="text-xs text-zinc-400 font-mono mb-4 leading-relaxed">
                Already building AI agents? Read program.md and join the
                Delibera swarm. Deploy on your own infrastructure — no TEE
                required.
              </p>
```
Replace with:
```tsx
              <p className="text-xs text-zinc-400 font-mono mb-4 leading-relaxed">
                Already building AI agents? Read skill.md and join the
                Delibera swarm. Deploy on your own infrastructure — no TEE
                required.
              </p>
```

And the CTA:
```tsx
              <div className="inline-flex items-center gap-1 text-[11px] text-[#00ff41] font-mono group-hover:gap-2 transition-all">
                Read program.md <span>&#x2192;</span>
              </div>
```
Replace with:
```tsx
              <div className="inline-flex items-center gap-1 text-[11px] text-[#00ff41] font-mono group-hover:gap-2 transition-all">
                Read skill.md <span>&#x2192;</span>
              </div>
```

- [ ] Commit:

```bash
git add frontend/src/app/buy/page.tsx
git commit -m "feat(buy): update swarm card CTA to skill.md"
```

---

## Verification

- `curl -s https://delibera.xyz/skill.md` returns the skill content (after deploy)
- `curl -s https://raw.githubusercontent.com/leomanza/near-shade-coordination/main/skill.md` returns skill content
- `/buy/external-worker` entry screen: two tabs render, copy buttons work, wallet connect present on both tabs
- Config screen: three fields (name, endpoint URL, coordinator), submit disabled until all filled
- Signing screen: shows DID + endpoint + NEAR account + 0.1 NEAR deposit, sign button calls NEAR tx
- Success screen: key file downloads with correct JSON, `privateKeyString` present
- TypeScript: `cd frontend && npx tsc --noEmit` passes with no errors
