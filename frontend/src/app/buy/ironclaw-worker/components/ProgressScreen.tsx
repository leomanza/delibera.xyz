import type { IronClawProvisionStatus } from "../hooks/useIronClawProvisionJob";

const STEPS: Array<{ status: IronClawProvisionStatus; label: string; note?: string }> = [
  { status: "generating_identity", label: "Generating worker identity" },
  { status: "creating_space", label: "Creating Storacha delegation" },
  { status: "creating_droplet", label: "Creating DigitalOcean Droplet" },
  { status: "waiting_for_ip", label: "Waiting for server IP" },
  { status: "waiting_for_ssh", label: "Server booting (cloud-init)" },
  { status: "configuring_agent", label: "Configuring Delibera agent" },
  { status: "starting_agent", label: "Starting IronClaw agent" },
  { status: "waiting_for_webhook", label: "Waiting for agent online", note: "3–5 min" },
  { status: "awaiting_near_signature", label: "Ready for NEAR registration" },
];

const ORDER = STEPS.map((s) => s.status);

export default function ProgressScreen({
  status,
  displayName,
}: {
  status: IronClawProvisionStatus;
  step: string;
  displayName?: string;
}) {
  const currentIdx = ORDER.indexOf(status);

  return (
    <div className="rounded border border-[#00ff41]/10 bg-[#0a0f0a]/80 p-6 terminal-card space-y-4">
      <h2 className="text-sm font-semibold text-zinc-100 font-mono">
        Deploying{displayName ? ` "${displayName}"` : ""}
        <span className="animate-pulse">...</span>
      </h2>

      <ul className="space-y-2">
        {STEPS.map((s, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <li key={s.status} className="flex items-center gap-2 text-[11px] font-mono">
              <span
                className={
                  isDone
                    ? "text-[#00ff41]"
                    : isActive
                    ? "text-amber-400"
                    : "text-zinc-700"
                }
              >
                {isDone ? "✓" : isActive ? "▶" : "○"}
              </span>
              <span
                className={
                  isDone
                    ? "text-zinc-400 line-through"
                    : isActive
                    ? "text-zinc-200"
                    : "text-zinc-700"
                }
              >
                {s.label}
              </span>
              {s.note && isActive && (
                <span className="text-[9px] text-zinc-600">({s.note})</span>
              )}
            </li>
          );
        })}
      </ul>

      {status === "waiting_for_webhook" && (
        <p className="text-[10px] text-zinc-600 font-mono">
          IronClaw initializes after cloud-init completes. Estimated 3–5 minutes.
        </p>
      )}
    </div>
  );
}
