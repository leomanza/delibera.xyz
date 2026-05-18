"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useIronClawProvisionJob, type IronClawProvisionStatus } from "./hooks/useIronClawProvisionJob";
import ConfigScreen from "./components/ConfigScreen";
import ProgressScreen from "./components/ProgressScreen";
import SuccessScreen from "./components/SuccessScreen";
import { humanizeDeployError } from "./lib/humanize-deploy-error";

const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ||
  "registry.agents-coordinator.testnet";

const REGISTER_GAS = "200000000000000"; // 200 Tgas
const REGISTER_DEPOSIT = "100000000000000000000000"; // 0.1 NEAR

export default function IronClawBuyPage() {
  const { accountId, connect, disconnect, connecting, signAndSendTransaction } =
    useAuth();
  const { job, loading, draft, startProvision, completeRegistration, reset, resetIncludingDraft } =
    useIronClawProvisionJob();

  // Sign-flow UI state. Errors stay on the Sign screen with an inline retry instead
  // of a blocking alert; "Skip" requires an explicit second click so users don't
  // orphan a paid droplet by mistake.
  const [signError, setSignError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [skipArmed, setSkipArmed] = useState(false);

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
    setSignError(null);
    setSigning(true);
    try {
      const result = await signAndSendTransaction({
        receiverId: REGISTRY_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "register_worker",
              args: {
                worker_did: job.workerDid,
                endpoint_url: job.phalaEndpoint,
                cvm_id: job.cvmId,
              },
              gas: REGISTER_GAS,
              deposit: REGISTER_DEPOSIT,
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
      // Only mark the job complete when we actually got a tx confirmation.
      // If signAndSendTransaction resolves without a hash (rare but possible on
      // some wallet variants), treat as a soft failure so the user can retry.
      if (!txHash) {
        setSignError(
          "Wallet returned no transaction hash. The signature may not have been broadcast — please retry.",
        );
        return;
      }
      await completeRegistration(txHash);
    } catch (err) {
      // Keep job state at `awaiting_near_signature` so Retry continues to work.
      setSignError(
        err instanceof Error ? err.message : "Unknown wallet error",
      );
    } finally {
      setSigning(false);
    }
  }, [job, completeRegistration, signAndSendTransaction]);

  const handleSkip = useCallback(async () => {
    // Two-click confirmation: first click arms the warning, second click confirms.
    // The deposit isn't reversible and the droplet is already running — make sure
    // the user knows what "Skip" actually means.
    if (!skipArmed) {
      setSkipArmed(true);
      setSignError(null);
      return;
    }
    await completeRegistration();
  }, [skipArmed, completeRegistration]);

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
            initialName={draft.displayName}
            initialCoordinatorDid={draft.coordinatorDid}
            initialRegion={draft.doRegion}
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
                <span className="text-zinc-600"> (refundable on unregister)</span>
              </div>
            </div>

            {/* Sophisticated NEAR users want to inspect contract / method / args /
                gas before signing; newcomers rely on the plain-English deposit line
                in the info box above. Collapsed by default so it doesn't crowd the CTA. */}
            <details className="rounded border border-zinc-800 bg-zinc-950/40 text-[10px] font-mono">
              <summary className="cursor-pointer px-3 py-2 text-zinc-400 hover:text-zinc-200 select-none">
                Transaction details
              </summary>
              <div className="px-3 pb-3 pt-1 text-zinc-500 space-y-1 border-t border-zinc-800/60">
                <div>
                  <span className="text-zinc-600">Receiver:</span>{" "}
                  <span className="text-zinc-300 break-all">{REGISTRY_CONTRACT_ID}</span>
                </div>
                <div>
                  <span className="text-zinc-600">Method:</span>{" "}
                  <span className="text-zinc-300">register_worker</span>
                </div>
                <div>
                  <span className="text-zinc-600">Gas:</span>{" "}
                  <span className="text-zinc-300">200 Tgas</span>
                </div>
                <div>
                  <span className="text-zinc-600">Deposit:</span>{" "}
                  <span className="text-zinc-300">0.1 NEAR</span>{" "}
                  <span className="text-zinc-600">(refundable on unregister)</span>
                </div>
                <div className="pt-2 text-zinc-400">Args:</div>
                <pre className="text-zinc-500 overflow-x-auto whitespace-pre-wrap break-all bg-zinc-950/60 border border-zinc-900 rounded p-2">
{JSON.stringify(
  {
    worker_did: job.workerDid,
    endpoint_url: job.phalaEndpoint,
    cvm_id: job.cvmId,
  },
  null,
  2,
)}
                </pre>
              </div>
            </details>

            {signError && (
              <div
                role="alert"
                className="rounded border border-red-900/40 bg-red-950/20 p-3 text-[10px] font-mono text-red-300 space-y-1"
              >
                <p className="font-semibold">Sign failed — retry available</p>
                <p className="opacity-80 break-words">{signError}</p>
                <p className="text-[9px] text-red-400/70 mt-1">
                  Your droplet is still running. The deposit was NOT charged.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSign}
                disabled={signing}
                className="flex-1 px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
              >
                {signing
                  ? "waiting for wallet..."
                  : signError
                  ? "Retry signing"
                  : "Sign with NEAR Wallet"}
              </button>
              <button
                onClick={handleSkip}
                disabled={signing}
                className={`px-4 py-3 rounded text-xs font-mono transition-colors disabled:opacity-40 ${
                  skipArmed
                    ? "border border-amber-700 bg-amber-950/30 text-amber-300 hover:border-amber-500"
                    : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {skipArmed ? "Confirm skip" : "Skip"}
              </button>
            </div>

            {skipArmed && (
              <p className="text-[10px] text-amber-400/80 font-mono">
                ⚠ Skip leaves the droplet running but NOT registered on-chain.
                The coordinator won&apos;t dispatch tasks to it. You can register
                manually later via CLI. Click &ldquo;Confirm skip&rdquo; again to proceed.
              </p>
            )}

            {!skipArmed && !signError && (
              <p className="text-[9px] text-zinc-600 font-mono">
                Skip only if you plan to register on-chain manually via CLI later.
              </p>
            )}
          </div>
        )}

        {screen === "success" && job && (
          <SuccessScreen job={job} onReset={resetIncludingDraft} />
        )}

        {screen === "error" && job && (() => {
          // Prefer the step inferred from the error message (more accurate than the
          // hook's last-seen status, which lags the 5s polling interval). Fall back
          // to the hook's attemptedStep, then to the very first step.
          const humanized = humanizeDeployError(
            job.error,
            (job.attemptedStep as IronClawProvisionStatus | undefined),
          );
          const attemptedStep: IronClawProvisionStatus =
            humanized.attemptedStep ??
            (job.attemptedStep as IronClawProvisionStatus | undefined) ??
            "generating_identity";
          return (
            <div className="space-y-4">
              <ProgressScreen
                status={attemptedStep}
                step={job.step}
                displayName={job.displayName}
                failedAt={attemptedStep}
              />
              <div className="rounded border border-red-900/40 bg-red-950/20 p-4 text-[11px] font-mono text-red-300 space-y-3">
                <div>
                  <p className="font-semibold text-red-200">{humanized.title}</p>
                  <p className="opacity-80 mt-1">{humanized.body}</p>
                </div>
                {!humanized.dropletCreated && (
                  <p className="text-[10px] text-emerald-400/80">
                    ✓ No droplet was created. Your DO account was not charged.
                  </p>
                )}
                {humanized.dropletCreated && (
                  <p className="text-[10px] text-amber-400/80">
                    ⚠ A droplet was briefly created. Our rollback should have destroyed it —
                    double-check your DO console to confirm.
                  </p>
                )}
                {job.error && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-400">
                      Raw error (for support)
                    </summary>
                    <pre className="mt-2 p-2 bg-zinc-950/60 border border-zinc-900 rounded text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
                      {job.error}
                    </pre>
                  </details>
                )}
                <button
                  onClick={reset}
                  className="w-full mt-2 px-4 py-2 rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 font-mono hover:border-zinc-500 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          );
        })()}

        <footer className="mt-8 text-center text-[10px] text-zinc-700 font-mono">
          NEAR Protocol · IronClaw · DigitalOcean · Storacha · Ensue Network
        </footer>
      </div>
    </div>
  );
}
