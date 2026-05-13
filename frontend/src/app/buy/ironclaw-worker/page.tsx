"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useIronClawProvisionJob } from "./hooks/useIronClawProvisionJob";
import ConfigScreen from "./components/ConfigScreen";
import ProgressScreen from "./components/ProgressScreen";
import SuccessScreen from "./components/SuccessScreen";

const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ||
  "registry.agents-coordinator.testnet";

export default function IronClawBuyPage() {
  const { accountId, connect, disconnect, connecting, signAndSendTransaction } =
    useAuth();
  const { job, loading, startProvision, completeRegistration, reset } =
    useIronClawProvisionJob();

  const screen = !accountId
    ? "entry"
    : !job
    ? "config"
    : job.status === "complete"
    ? "success"
    : job.status === "failed"
    ? "error"
    : job.status === "awaiting_near_signature"
    ? "sign"
    : "provisioning";

  const handleDeploy = useCallback(
    async (params: {
      coordinatorDid: string;
      displayName: string;
      doApiToken: string;
      doRegion: string;
      nearAiApiKey: string;
    }) => {
      if (!accountId) return;
      await startProvision({ ...params, nearAccount: accountId });
    },
    [accountId, startProvision],
  );

  const handleSign = useCallback(async () => {
    if (!job?.workerDid || !job?.phalaEndpoint || !job?.cvmId) return;
    try {
      const result = await signAndSendTransaction({
        receiverId: REGISTRY_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "register_worker",
              args: {
                coordinator_did: job.coordinatorDid,
                worker_did: job.workerDid,
                endpoint_url: job.phalaEndpoint,
                cvm_id: job.cvmId,
              },
              gas: "200000000000000",
              deposit: "100000000000000000000000",
            },
          },
        ],
      });
      const txHash =
        typeof result === "object" && result !== null
          ? (result as { transaction?: { hash?: string }; txHash?: string })
              .transaction?.hash ||
            (result as { txHash?: string }).txHash
          : undefined;
      await completeRegistration(txHash);
    } catch (err) {
      alert(
        `Transaction failed: ${err instanceof Error ? err.message : "Unknown error"}. You can skip and register manually later.`,
      );
    }
  }, [job, completeRegistration, signAndSendTransaction]);

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-10 max-w-2xl mx-auto">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none opacity-30" />

      <div className="relative z-10">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src="/logo-iso.svg" alt="Delibera" className="h-8 w-8" />
              <h1 className="text-xl font-bold text-zinc-100 font-mono">
                Delibera
              </h1>
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
          <p className="text-sm text-zinc-500 font-mono">
            One-Click IronClaw Worker Deployment
          </p>
        </header>

        {screen === "entry" && (
          <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card">
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
            >
              {connecting ? "connecting..." : "Connect NEAR Wallet"}
            </button>
          </div>
        )}

        {screen === "config" && (
          <ConfigScreen
            accountId={accountId!}
            loading={loading}
            onDeploy={handleDeploy}
          />
        )}

        {screen === "provisioning" && job && (
          <ProgressScreen
            status={job.status}
            step={job.step}
            displayName={job.displayName}
          />
        )}

        {screen === "sign" && job && (
          <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 font-mono">
              Sign to register on NEAR
            </h3>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-1.5 text-[10px] font-mono">
              <div>
                <span className="text-zinc-600">Worker DID:</span>{" "}
                <span className="text-zinc-400 break-all">{job.workerDid}</span>
              </div>
              <div>
                <span className="text-zinc-600">Webhook URL:</span>{" "}
                <span className="text-zinc-400">{job.phalaEndpoint}</span>
              </div>
              <div>
                <span className="text-zinc-600">Deposit:</span>{" "}
                <span className="text-zinc-300">0.1 NEAR</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSign}
                className="flex-1 px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all"
              >
                Sign with NEAR Wallet
              </button>
              <button
                onClick={() => completeRegistration()}
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

        {screen === "success" && job && (
          <SuccessScreen job={job} onReset={reset} />
        )}

        {screen === "error" && (
          <div className="rounded border border-red-900/40 bg-red-950/20 p-5 text-xs font-mono text-red-400 space-y-3">
            <p className="font-semibold">Deployment failed</p>
            {job?.error && <p className="text-[10px] opacity-80">{job.error}</p>}
            <button
              onClick={reset}
              className="text-zinc-400 text-[10px] underline"
            >
              Try again
            </button>
          </div>
        )}

        <footer className="mt-8 text-center text-[10px] text-zinc-700 font-mono">
          NEAR Protocol · IronClaw · DigitalOcean · Storacha · Ensue Network
        </footer>
      </div>
    </div>
  );
}
