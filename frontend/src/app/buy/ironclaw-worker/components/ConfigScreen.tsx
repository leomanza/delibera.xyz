"use client";

import { useState } from "react";

interface Props {
  accountId: string;
  loading: boolean;
  onDeploy: (params: {
    coordinatorDid: string;
    displayName: string;
    doApiToken: string;
    doRegion: string;
    nearAiApiKey: string;
  }) => void;
}

export default function ConfigScreen({ loading, onDeploy }: Props) {
  const [name, setName] = useState("");
  const [coordinatorDid, setCoordinatorDid] = useState("");
  const [doApiToken, setDoApiToken] = useState("");
  const [doRegion, setDoRegion] = useState("nyc3");
  const [nearAiApiKey, setNearAiApiKey] = useState("");

  const canDeploy =
    name.trim() &&
    coordinatorDid.trim() &&
    doApiToken.trim() &&
    nearAiApiKey.trim() &&
    !loading;

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
      <h2 className="text-sm font-semibold text-zinc-100 font-mono">
        Deploy IronClaw Worker
      </h2>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500 font-mono">Worker name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-zinc-600"
          placeholder="my-agent"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500 font-mono">Coordinator DID</span>
        <input
          value={coordinatorDid}
          onChange={(e) => setCoordinatorDid(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-zinc-600"
          placeholder="did:key:z6Mk..."
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500 font-mono">Region</span>
        <select
          value={doRegion}
          onChange={(e) => setDoRegion(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-zinc-600"
        >
          <option value="nyc3">New York (nyc3)</option>
          <option value="ams3">Amsterdam (ams3)</option>
          <option value="sgp1">Singapore (sgp1)</option>
          <option value="lon1">London (lon1)</option>
          <option value="fra1">Frankfurt (fra1)</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500 font-mono">
          DigitalOcean API Token
        </span>
        <input
          type="password"
          value={doApiToken}
          onChange={(e) => setDoApiToken(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-zinc-600"
          placeholder="dop_v1_..."
          autoComplete="off"
        />
        <p className="text-[9px] text-zinc-600 font-mono">
          Used only during deployment. Never stored server-side.
        </p>
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-500 font-mono">NEAR AI API Key</span>
        <input
          type="password"
          value={nearAiApiKey}
          onChange={(e) => setNearAiApiKey(e.target.value)}
          className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-zinc-600"
          placeholder="key-..."
          autoComplete="off"
        />
      </label>

      <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800 text-[10px] text-zinc-500 font-mono">
        This will create a{" "}
        <span className="text-zinc-300 font-semibold">$4/month</span>{" "}
        DigitalOcean Droplet (1 vCPU, 1 GB) billed directly to your DO account.
      </div>

      <button
        onClick={() =>
          onDeploy({
            coordinatorDid: coordinatorDid.trim(),
            displayName: name.trim(),
            doApiToken,
            doRegion,
            nearAiApiKey,
          })
        }
        disabled={!canDeploy}
        className="w-full px-4 py-3 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-sm font-semibold text-[#00ff41] font-mono hover:bg-[#00ff41]/15 transition-all disabled:opacity-40"
      >
        {loading ? "deploying..." : "Deploy Worker"}
      </button>
    </div>
  );
}
