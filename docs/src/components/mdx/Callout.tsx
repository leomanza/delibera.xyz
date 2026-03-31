type CalloutType = "info" | "warning" | "danger" | "tip";

const styles: Record<
  CalloutType,
  { border: string; bg: string; icon: string; label: string }
> = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: "i",
    label: "Info",
  },
  tip: {
    border: "border-[#00ff41]/30",
    bg: "bg-[#00ff41]/5",
    icon: "✓",
    label: "Tip",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    icon: "!",
    label: "Warning",
  },
  danger: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    icon: "✕",
    label: "Danger",
  },
};

export function Callout({
  type = "info",
  children,
}: {
  type?: CalloutType;
  children: React.ReactNode;
}) {
  const s = styles[type];
  return (
    <div
      className={`${s.bg} ${s.border} border-l-3 rounded-r-lg px-4 py-3 my-5`}
    >
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-bold mt-0.5 opacity-60">
          [{s.label}]
        </span>
        <div className="flex-1 text-sm [&>p]:m-0">{children}</div>
      </div>
    </div>
  );
}
