import type { IronClawJobState } from "../hooks/useIronClawProvisionJob";

export default function SuccessScreen({
  job,
  onReset,
}: {
  job: IronClawJobState;
  onReset: () => void;
}) {
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
      </div>

      <div className="p-3 rounded bg-amber-950/30 border border-amber-800/40 text-[10px] text-amber-400 font-mono">
        Save your recovery file. The webhook secret is stored there and required to
        reconfigure your worker.
      </div>

      <button
        onClick={onReset}
        className="w-full px-4 py-2 rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-400 font-mono hover:border-zinc-600 transition-colors"
      >
        Deploy another
      </button>
    </div>
  );
}
