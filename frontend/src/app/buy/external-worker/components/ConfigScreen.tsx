"use client";

import { useState, useEffect } from "react";
import { getActiveCoordinators, type RegistryCoordinator } from "@/lib/api";

interface ConfigScreenProps {
  accountId: string;
  loading: boolean;
  error: string | null;
  onSubmit: (params: {
    displayName: string;
    coordinatorDid: string;
  }) => void;
}

function coordLabel(c: RegistryCoordinator): string {
  return c.account_id || `${c.coordinator_did.substring(0, 20)}...`;
}

export default function ConfigScreen({ accountId, loading, error, onSubmit }: ConfigScreenProps) {
  const [displayName, setDisplayName] = useState("");
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

  const canSubmit = displayName.length >= 2 && coordinatorDid;

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-5">
      {/* program.md link — prominent */}
      <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1">
        <p className="text-[10px] text-zinc-400 font-mono">
          &#128196; Read{" "}
          <a
            href="https://github.com/leomanza/near-shade-coordination/blob/main/program.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00ff41] hover:underline"
          >
            program.md
          </a>{" "}
          to set up your agent. When you&apos;re ready, generate your identity below and follow the
          config instructions.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-100 font-mono mb-1">
          Generate Agent Identity
        </h3>
        <p className="text-[10px] text-zinc-600 font-mono">
          Creates a DID keypair for your agent. Save the key file — it configures your worker&apos;s
          sovereign identity.
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
          onClick={() => onSubmit({ displayName, coordinatorDid })}
          disabled={!canSubmit || loading}
          className="w-full mt-2 px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? "generating..." : "Generate Identity"}
        </button>
      </div>
    </div>
  );
}
