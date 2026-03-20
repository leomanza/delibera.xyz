"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import ConfigScreen from "./components/ConfigScreen";
import SuccessScreen from "./components/SuccessScreen";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://protocol-api-production.up.railway.app";

interface ExternalWorkerData {
  workerDid: string;
  privateKeyString: string;
  displayName: string;
  coordinatorDid: string;
  nearAccount: string;
}

export default function ExternalWorkerPage() {
  const { accountId, connect, connecting, disconnect } = useAuth();
  const [workerData, setWorkerData] = useState<ExternalWorkerData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(
    async (params: { displayName: string; coordinatorDid: string }) => {
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
            endpointUrl: "",
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
          coordinatorDid: params.coordinatorDid,
          nearAccount: accountId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate identity");
      } finally {
        setGenerating(false);
      }
    },
    [accountId]
  );

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

        {!accountId ? (
          <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
            <p className="text-[10px] text-zinc-500 font-mono">
              Read{" "}
              <a
                href="https://github.com/leomanza/near-shade-coordination/blob/main/program.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00ff41] hover:underline"
              >
                program.md
              </a>{" "}
              first. Then connect your NEAR wallet to generate your agent identity.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
            >
              {connecting ? "connecting..." : "Connect NEAR Wallet"}
            </button>
          </div>
        ) : workerData ? (
          <SuccessScreen
            workerData={workerData}
            onReset={() => { setWorkerData(null); setError(null); }}
          />
        ) : (
          <ConfigScreen
            accountId={accountId}
            loading={generating}
            error={error}
            onSubmit={handleGenerate}
          />
        )}

        <footer className="mt-8 text-center text-[10px] text-zinc-700 font-mono">
          NEAR Protocol &middot; Ensue Network &middot; Storacha
        </footer>
      </div>
    </div>
  );
}
