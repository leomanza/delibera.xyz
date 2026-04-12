"use client";

/**
 * /x402-demo — interactive buyer-agent demo (Pattern C).
 *
 * Talks to /api/x402-demo (which runs the same x402 client.ts flow
 * server-side) and renders the SSE lifecycle as a live stepper. The whole
 * point is that a judge clicks one button and watches a real Stellar testnet
 * tx settle + a real NEAR on-chain deliberation complete, without installing
 * a wallet.
 */

import Link from "next/link";
import { useState, useRef } from "react";

/* ─── Default demo proposal (same as x402-client/client.ts) ─────────────── */

const DEFAULT_PROPOSAL =
  "Should the DAO allocate 50,000 USDC from the treasury to fund a six-month developer education program, given the treasury currently holds 2M USDC and burns ~100K/month?";

const DEFAULT_CONTEXT = {
  dao: "demo-dao.testnet",
  treasury_balance_usdc: 2_000_000,
  monthly_burn_usdc: 100_000,
  proposal_amount_usdc: 50_000,
  rationale:
    "The program would onboard ~200 new contributors over six months. Historical return on similar programs has ranged from -20% to +150% in measurable retained contributors. Three worker agents with different governance perspectives should deliberate.",
};

/* ─── Types matching the SSE wire format in /api/x402-demo ──────────────── */

type Phase =
  | "idle"
  | "discovering"
  | "discovered"
  | "paying"
  | "deliberating"
  | "verdict"
  | "failed";

interface WorkerOutput {
  workerId: string;
  output: { vote?: string; reasoning?: string };
}

interface Verdict {
  decision: string;
  approved: number;
  rejected: number;
  workerCount: number;
  aggregatedValue: number;
  workers: WorkerOutput[];
}

interface DemoState {
  phase: Phase;
  stellarTx?: string | null;
  verdict?: Verdict;
  deliberationId?: string;
  nearProposalId?: number | null;
  error?: string;
  elapsedMs?: number;
  buyerAddress?: string;
  payTo?: string;
  endpoints?: Array<{ method: string; path: string; price: string }>;
  serviceName?: string;
}

const INITIAL_STATE: DemoState = { phase: "idle" };

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function X402DemoPage() {
  const [proposal, setProposal] = useState(DEFAULT_PROPOSAL);
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const running = state.phase !== "idle" && state.phase !== "verdict" && state.phase !== "failed";

  async function runDemo(): Promise<void> {
    // Reset state and kick off SSE stream.
    setState({ phase: "discovering" });
    const controller = new AbortController();
    abortRef.current = controller;

    let res: Response;
    try {
      res = await fetch("/api/x402-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal, context: DEFAULT_CONTEXT }),
        signal: controller.signal,
      });
    } catch (err) {
      setState({
        phase: "failed",
        error: `Could not reach /api/x402-demo: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    if (!res.ok) {
      // Rate limit or validation error — parse JSON and surface it.
      let msg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {
        /* ignore */
      }
      setState({ phase: "failed", error: msg });
      return;
    }

    if (!res.body) {
      setState({ phase: "failed", error: "No response body (SSE stream missing)" });
      return;
    }

    // Parse SSE events as they arrive.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Events are separated by double-newline.
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          if (!raw.trim()) continue;
          let eventType = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (eventType !== "update" || !data) continue;
          try {
            const parsed = JSON.parse(data) as Partial<DemoState> & { phase: Phase };
            setState((prev) => ({ ...prev, ...parsed }));
          } catch (err) {
            console.warn("[x402-demo] failed to parse SSE data:", data, err);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((prev) => ({
          ...prev,
          phase: "failed",
          error: `Stream error: ${err instanceof Error ? err.message : String(err)}`,
        }));
      }
    } finally {
      abortRef.current = null;
    }
  }

  function reset(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none opacity-30" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 py-10">
        <Header />
        <Intro />

        <ProposalEditor
          proposal={proposal}
          onChange={setProposal}
          disabled={running}
        />

        <RunButton
          running={running}
          phase={state.phase}
          onRun={runDemo}
          onReset={reset}
        />

        {state.phase !== "idle" && (
          <>
            <Stepper state={state} />
            {state.phase === "verdict" && state.verdict && (
              <VerdictCard state={state} />
            )}
            {state.phase === "failed" && <FailedCard state={state} />}
          </>
        )}

        <CostFooter />
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img src="/logo-iso.svg" alt="Delibera" className="h-8 w-8" />
        <span className="text-lg font-bold text-zinc-100 font-mono">Delibera</span>
      </Link>
      <Link
        href="/"
        className="text-xs text-zinc-600 hover:text-[#00ff41] transition-colors font-mono"
      >
        &larr; back to home
      </Link>
    </header>
  );
}

function Intro() {
  return (
    <section className="mb-10">
      <div className="text-xs text-[#00ff41]/40 font-mono mb-2">
        {"// the paid deliberation oracle"}
      </div>
      <h1 className="text-3xl md:text-4xl font-bold font-mono mb-4 tracking-tight">
        Ask the <span className="text-[#00ff41] text-glow-green">Oracle</span>
      </h1>
      <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
        Pay <span className="text-zinc-200">$0.01 USDC</span> on Stellar testnet. Three
        AI agents running in Phala TEEs deliberate on your proposal and return a signed
        verdict on NEAR. No wallet required &mdash; a server-side demo agent pays on your
        behalf so you can watch the x402 flow end-to-end.
      </p>
    </section>
  );
}

function ProposalEditor({
  proposal,
  onChange,
  disabled,
}: {
  proposal: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="mb-6">
      <label className="block text-xs font-mono text-[#00ff41]/60 mb-2">
        {"// proposal"}
      </label>
      <textarea
        value={proposal}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        maxLength={8000}
        className="w-full rounded border border-[#00ff41]/20 bg-[#0a0f0a]/80 p-4
                   text-sm text-zinc-200 font-mono leading-relaxed
                   focus:border-[#00ff41]/50 focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed
                   terminal-card"
        placeholder="Describe a DAO proposal for the swarm to deliberate on..."
      />
      <div className="mt-1 text-[10px] text-zinc-600 font-mono text-right">
        {proposal.length} / 8000
      </div>
    </section>
  );
}

function RunButton({
  running,
  phase,
  onRun,
  onReset,
}: {
  running: boolean;
  phase: Phase;
  onRun: () => void;
  onReset: () => void;
}) {
  if (running) {
    return (
      <div className="mb-10 flex items-center gap-4">
        <button
          disabled
          className="px-6 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30
                     text-sm font-semibold text-[#00ff41] font-mono
                     cursor-not-allowed opacity-80"
        >
          <span className="inline-block animate-pulse">●</span> deliberating...
        </button>
        <button
          onClick={onReset}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
        >
          cancel
        </button>
      </div>
    );
  }

  if (phase === "verdict" || phase === "failed") {
    return (
      <div className="mb-10">
        <button
          onClick={onReset}
          className="px-6 py-3 rounded bg-zinc-800 border border-zinc-700
                     text-sm font-semibold text-zinc-300 font-mono
                     hover:bg-zinc-700 hover:border-zinc-600 transition-all"
        >
          &larr; run another deliberation
        </button>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <button
        onClick={onRun}
        className="px-6 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30
                   text-sm font-semibold text-[#00ff41] font-mono
                   shadow-[0_0_20px_rgba(0,255,65,0.1)]
                   hover:bg-[#00ff41]/15 hover:shadow-[0_0_30px_rgba(0,255,65,0.2)]
                   transition-all"
      >
        &gt; run autonomous deliberation &mdash; $0.01 USDC
      </button>
    </div>
  );
}

/* ─── Stepper ──────────────────────────────────────────────────────────── */

const STEPS: Array<{ key: Phase; label: string; detail: string }> = [
  { key: "discovering", label: "1. Discover", detail: "fetch /x402/info" },
  { key: "paying", label: "2. Pay", detail: "x402 + Stellar USDC" },
  { key: "deliberating", label: "3. Deliberate", detail: "3 AI agents vote" },
  { key: "verdict", label: "4. Verdict", detail: "signed on NEAR" },
];

function Stepper({ state }: { state: DemoState }) {
  const phaseOrder: Phase[] = [
    "discovering",
    "discovered",
    "paying",
    "deliberating",
    "verdict",
  ];
  const currentIdx = phaseOrder.indexOf(state.phase);

  function stepStatus(stepKey: Phase): "pending" | "active" | "done" | "failed" {
    if (state.phase === "failed") {
      // Mark any step up to and including the failed step as failed; earlier
      // as done.
      const failedAt = inferFailedAt(state);
      const stepIdx = STEPS.findIndex((s) => s.key === stepKey);
      const failedIdx = STEPS.findIndex((s) => s.key === failedAt);
      if (stepIdx < failedIdx) return "done";
      if (stepIdx === failedIdx) return "failed";
      return "pending";
    }
    const stepIdx = phaseOrder.indexOf(stepKey);
    if (stepIdx === -1) return "pending";
    if (currentIdx > stepIdx) return "done";
    if (currentIdx === stepIdx) return "active";
    // Special case: if we're on 'discovered', mark 'discovering' as done.
    if (stepKey === "discovering" && state.phase === "discovered") return "done";
    return "pending";
  }

  return (
    <section className="mb-10">
      <div className="text-xs text-[#00ff41]/40 font-mono mb-3">
        {"// lifecycle"}
      </div>
      <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {STEPS.map((step) => {
            const status = stepStatus(step.key);
            return <StepTile key={step.key} step={step} status={status} />;
          })}
        </div>

        {/* Contextual detail under the stepper */}
        <div className="mt-6 pt-4 border-t border-[#00ff41]/10 space-y-1">
          {state.buyerAddress && (
            <DetailRow label="buyer" value={shortAddr(state.buyerAddress)} />
          )}
          {state.payTo && (
            <DetailRow label="seller" value={shortAddr(state.payTo)} />
          )}
          {state.stellarTx && (
            <DetailRow
              label="stellar tx"
              value={shortHash(state.stellarTx)}
              link={stellarExpertTxUrl(state.stellarTx)}
            />
          )}
          {state.deliberationId && (
            <DetailRow label="delib id" value={state.deliberationId} />
          )}
          {state.nearProposalId != null && (
            <DetailRow label="near proposal" value={`#${state.nearProposalId}`} />
          )}
          {typeof state.elapsedMs === "number" && (
            <DetailRow
              label="elapsed"
              value={`${(state.elapsedMs / 1000).toFixed(1)}s`}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function inferFailedAt(state: DemoState): Phase {
  // Heuristic: if we have a stellarTx, payment succeeded, so we failed during
  // deliberation. Otherwise we failed earlier (discover or pay).
  if (state.stellarTx) return "deliberating";
  if (state.buyerAddress) return "paying";
  return "discovering";
}

// Hoisted static style map — avoids per-render object allocation in StepTile
// and sidesteps an unnecessary useMemo. Each key maps to the className
// fragments for that visual state of the stepper tile.
const STEP_TILE_STYLES: Record<
  "pending" | "active" | "done" | "failed",
  { border: string; text: string; badge: string; bgGlow: string }
> = {
  done: {
    border: "border-[#00ff41]/40",
    text: "text-[#00ff41]",
    badge: "✓",
    bgGlow: "shadow-[0_0_15px_rgba(0,255,65,0.1)]",
  },
  active: {
    border: "border-[#00ff41]/30 animate-pulse",
    text: "text-[#00ff41]/90",
    badge: "●",
    bgGlow: "shadow-[0_0_20px_rgba(0,255,65,0.15)]",
  },
  failed: {
    border: "border-red-500/40",
    text: "text-red-400",
    badge: "✗",
    bgGlow: "shadow-[0_0_15px_rgba(239,68,68,0.1)]",
  },
  pending: {
    border: "border-zinc-800",
    text: "text-zinc-600",
    badge: "○",
    bgGlow: "",
  },
};

function StepTile({
  step,
  status,
}: {
  step: { key: Phase; label: string; detail: string };
  status: "pending" | "active" | "done" | "failed";
}) {
  const styles = STEP_TILE_STYLES[status];
  return (
    <div
      className={`rounded border ${styles.border} bg-[#050505]/80 p-4 ${styles.bgGlow} transition-all`}
    >
      <div className={`text-xs font-mono ${styles.text} mb-2`}>
        <span className="mr-2">{styles.badge}</span>
        {step.label}
      </div>
      <div className="text-[10px] text-zinc-600 font-mono">{step.detail}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string;
}) {
  const displayValue = link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#00ff41]/80 hover:text-[#00ff41] hover:underline"
    >
      {value} &nearr;
    </a>
  ) : (
    <span className="text-zinc-300">{value}</span>
  );
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-zinc-600">{label}</span>
      {displayValue}
    </div>
  );
}

/* ─── Verdict + Failed cards ────────────────────────────────────────────── */

function VerdictCard({ state }: { state: DemoState }) {
  const v = state.verdict!;
  const approved = v.decision === "Approved";
  return (
    <section className="mb-10">
      <div className="text-xs text-[#00ff41]/40 font-mono mb-3">{"// verdict"}</div>
      <div
        className={`rounded border ${
          approved ? "border-[#00ff41]/40" : "border-red-500/40"
        } bg-[#0a0f0a]/80 p-6 terminal-card
                    ${approved ? "shadow-[0_0_30px_rgba(0,255,65,0.15)]" : "shadow-[0_0_30px_rgba(239,68,68,0.15)]"}`}
      >
        <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-[#00ff41]/10">
          <div>
            <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
              decision
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                approved ? "text-[#00ff41] text-glow-green" : "text-red-400"
              }`}
            >
              {v.decision}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">
              tally
            </div>
            <div className="text-sm font-mono text-zinc-300">
              <span className="text-[#00ff41]">{v.approved}</span>
              {" / "}
              <span className="text-red-400">{v.rejected}</span>
              {" / "}
              <span className="text-zinc-500">{v.workerCount}</span>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono">
              approved / rejected / total
            </div>
          </div>
        </div>

        <div className="mb-5 rounded border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div className="text-[10px] text-cyan-300/80 font-mono mb-2 uppercase tracking-wider">
            {"[ demo disclosure · how delibera normally works ]"}
          </div>
          <p className="text-[11px] text-zinc-400 font-mono leading-relaxed mb-2">
            In production, per-worker reasoning stays private in{" "}
            <span className="text-cyan-300">Ensue shared memory</span> —
            encrypted with Lit Protocol threshold keys, persisted to Storacha,
            auto-archived to Filecoin. Each vote carries a{" "}
            <span className="text-cyan-300">NEAR AI verification proof</span>{" "}
            (TEE-signed attestation that a specific model deliberated), but only
            the <span className="text-cyan-300">aggregate tally</span> (N
            approved / M rejected) ever touches the NEAR blockchain.
          </p>
          <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
            This demo surfaces the raw reasoning so you can verify the swarm
            actually deliberated — in the real protocol, x402 buyers receive
            only the final verdict and the signed on-chain proposal id.
          </p>
        </div>

        <div className="text-[10px] text-[#00ff41]/60 font-mono mb-3">
          {"// worker reasoning (demo only)"}
        </div>
        <div className="space-y-3">
          {v.workers.map((worker) => {
            const voteApproved = worker.output?.vote === "Approved";
            return (
              <div
                key={worker.workerId}
                className="rounded border border-zinc-800 bg-[#050505]/80 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {worker.workerId}
                  </span>
                  <span className="text-zinc-700">&rarr;</span>
                  <span
                    className={`text-[11px] font-mono font-semibold ${
                      voteApproved ? "text-[#00ff41]" : "text-red-400"
                    }`}
                  >
                    {worker.output?.vote ?? "(no vote)"}
                  </span>
                </div>
                {worker.output?.reasoning && (
                  <div className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                    {worker.output.reasoning.slice(0, 400)}
                    {worker.output.reasoning.length > 400 ? "…" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FailedCard({ state }: { state: DemoState }) {
  return (
    <section className="mb-10">
      <div className="text-xs text-red-500/60 font-mono mb-3">{"// failed"}</div>
      <div className="rounded border border-red-500/30 bg-[#0a0a0a]/80 p-6 terminal-card">
        <div className="text-sm font-semibold text-red-400 font-mono mb-2">
          ✗ Deliberation did not complete
        </div>
        <div className="text-[11px] text-zinc-500 font-mono leading-relaxed">
          {state.error ?? "Unknown error"}
        </div>
        {state.deliberationId && (
          <div className="text-[10px] text-zinc-600 font-mono mt-3">
            id: {state.deliberationId}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Cost footer ───────────────────────────────────────────────────────── */

function CostFooter() {
  return (
    <footer className="mt-16 pt-8 border-t border-zinc-900 text-[10px] text-zinc-700 font-mono">
      <div className="mb-2">
        {"// cost: $0.01 USDC per deliberation · Stellar network fees sponsored by OZ Channels"}
      </div>
      <div>
        {"// built on Stellar testnet · NEAR protocol · Phala TEE · x402"}
      </div>
    </footer>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function stellarExpertTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}
