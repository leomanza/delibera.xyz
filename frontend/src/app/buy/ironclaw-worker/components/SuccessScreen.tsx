"use client";

import { useState } from "react";
import Link from "next/link";
import type { IronClawJobState } from "../hooks/useIronClawProvisionJob";
import { buildRecoveryFile, downloadJson } from "../lib/recovery-file";

/**
 * NearBlocks subdomain depends on network. Testnet uses `testnet.nearblocks.io`,
 * mainnet uses `nearblocks.io`. We default to testnet so non-prod deploys link
 * to the right explorer.
 */
const NEAR_NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet";
const EXPLORER_BASE =
  NEAR_NETWORK === "mainnet"
    ? "https://nearblocks.io/txns"
    : "https://testnet.nearblocks.io/txns";

export default function SuccessScreen({
  job,
  onReset,
}: {
  job: IronClawJobState;
  onReset: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const recovery = buildRecoveryFile(job);

  const handleDownload = () => {
    if (!recovery) return;
    downloadJson(recovery.filename, recovery.json);
    setDownloaded(true);
  };

  const txHash = job.registrationTxHash;

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
      <h2 className="text-sm font-semibold text-[#00ff41] font-mono">
        Worker deployed ✓
      </h2>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-1.5 text-[10px] font-mono">
        <div>
          <span className="text-zinc-600">Worker DID:</span>{" "}
          <span className="text-zinc-300 break-all">{job.workerDid}</span>
        </div>
        <div>
          <span className="text-zinc-600">Droplet IP:</span>{" "}
          <span className="text-zinc-300">{job.dropletIp ?? "—"}</span>
        </div>
        <div>
          <span className="text-zinc-600">Webhook URL:</span>{" "}
          <span className="text-zinc-300 break-all">{job.phalaEndpoint ?? "—"}</span>
        </div>
        <div>
          <span className="text-zinc-600">CVM ID:</span>{" "}
          <span className="text-zinc-300">{job.cvmId ?? "—"}</span>
        </div>
        {txHash && (
          <div>
            <span className="text-zinc-600">On-chain tx:</span>{" "}
            <a
              href={`${EXPLORER_BASE}/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ff41] underline hover:text-[#33ff66] break-all"
            >
              {txHash.length > 24
                ? `${txHash.slice(0, 12)}…${txHash.slice(-6)}`
                : txHash}{" "}
              ↗
            </a>
          </div>
        )}
      </div>

      {recovery ? (
        <div
          className={`p-3 rounded border text-[10px] font-mono space-y-2 ${
            downloaded
              ? "bg-zinc-900/40 border-zinc-800 text-zinc-400"
              : "bg-amber-950/30 border-amber-800/40 text-amber-400"
          }`}
        >
          <p className="font-semibold">
            {downloaded ? "Recovery file saved" : "Download your recovery file"}
          </p>
          <p className="opacity-80">
            {downloaded
              ? "Keep it somewhere safe — it contains the webhook secret needed to reconfigure or migrate this worker."
              : "Contains your webhook secret (required to reconfigure or migrate the worker later). The secret is not recoverable from this page after you close it."}
          </p>
          <button
            onClick={handleDownload}
            className={`w-full px-3 py-2 rounded text-[11px] font-mono transition-colors ${
              downloaded
                ? "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                : "border border-amber-700 bg-amber-950/40 text-amber-300 hover:border-amber-500"
            }`}
          >
            {downloaded ? "Download again" : "↓ Download recovery file"}
          </button>
        </div>
      ) : (
        <div className="p-3 rounded bg-zinc-900/40 border border-zinc-800 text-[10px] text-zinc-500 font-mono">
          Recovery file unavailable — webhook secret not present in the job
          response. Re-deploy if you need access to the secret.
        </div>
      )}

      {/* Primary CTA points to where the user actually wants to go next: the dashboard.
          "Deploy another" is a secondary text link. */}
      <Link
        href="/dashboard"
        className="block w-full text-center px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all"
      >
        View dashboard →
      </Link>
      <button
        onClick={onReset}
        className="w-full px-2 py-1 text-[10px] text-zinc-500 font-mono hover:text-zinc-300 transition-colors"
      >
        Deploy another worker
      </button>
    </div>
  );
}
