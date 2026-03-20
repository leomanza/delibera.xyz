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
