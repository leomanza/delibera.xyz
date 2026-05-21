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
