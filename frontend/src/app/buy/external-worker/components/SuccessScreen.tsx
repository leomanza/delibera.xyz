"use client";

import { useState } from "react";

interface ExternalWorkerData {
  workerDid: string;
  privateKeyString: string;
  displayName: string;
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
      coordinatorDid: workerData.coordinatorDid,
      nearAccount: workerData.nearAccount,
      generatedAt: new Date().toISOString(),
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
        <h3 className="text-sm font-semibold text-zinc-100 font-mono">Identity generated</h3>
      </div>

      {/* Step 1 — Download key */}
      <div className="p-3 rounded bg-amber-950/30 border border-amber-700/40 space-y-2">
        <p className="text-[10px] text-amber-400 font-mono font-semibold">
          &#9888; Step 1 — Download your key file now
        </p>
        <p className="text-[10px] text-amber-500/80 font-mono">
          This private key cannot be recovered. Set{" "}
          <span className="text-amber-300">STORACHA_AGENT_PRIVATE_KEY</span> in your{" "}
          <span className="text-amber-300">.env</span> file to the{" "}
          <span className="text-amber-300">privateKeyString</span> value.
        </p>
        <button
          onClick={downloadKeyFile}
          className="w-full px-3 py-2 rounded bg-amber-900/40 border border-amber-700/50 text-xs text-amber-300 font-mono hover:bg-amber-900/60 transition-colors"
        >
          &#8659; Download Key File
        </button>
      </div>

      {/* Step 2 — program.md */}
      <div className="p-3 rounded bg-[#00ff41]/5 border border-[#00ff41]/20 space-y-2">
        <p className="text-[10px] text-[#00ff41]/80 font-mono font-semibold">
          Step 2 — Follow program.md to set up and run your worker
        </p>
        <p className="text-[10px] text-zinc-500 font-mono">
          The guide covers: configuring env vars, running the worker, and joining the swarm.
          Your worker will auto-register on NEAR on first startup (0.1 NEAR required).
        </p>
        <a
          href="https://github.com/leomanza/near-shade-coordination/blob/main/program.md"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-3 py-2 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-xs text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-colors"
        >
          Read program.md &#x2192;
        </a>
      </div>

      {/* DID reference */}
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
          <span className="text-zinc-600">Coordinator:</span>{" "}
          <span className="text-zinc-500 break-all">
            {workerData.coordinatorDid.length > 40
              ? workerData.coordinatorDid.substring(0, 30) + "..."
              : workerData.coordinatorDid}
          </span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full px-3 py-2 rounded border border-zinc-800 bg-zinc-900/40 text-[10px] text-zinc-500 font-mono hover:border-zinc-700 hover:text-zinc-400 transition-colors"
      >
        Generate another identity
      </button>
    </div>
  );
}
