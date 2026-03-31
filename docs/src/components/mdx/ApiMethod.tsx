export function ApiMethod({
  name,
  method = "POST",
  path,
  caller,
  gas,
  deposit,
  children,
}: {
  name: string;
  method?: string;
  path?: string;
  caller?: string;
  gas?: string;
  deposit?: string;
  children: React.ReactNode;
}) {
  const methodColors: Record<string, string> = {
    GET: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    POST: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    PUT: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    DELETE: "text-red-400 bg-red-400/10 border-red-400/20",
    VIEW: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    CALL: "text-[#00ff41] bg-[#00ff41]/10 border-[#00ff41]/20",
  };

  const color = methodColors[method] || methodColors.POST;

  return (
    <div className="border border-zinc-800 rounded-lg my-5 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${color}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-zinc-200">
          {path || name}
        </code>
      </div>
      {(caller || gas || deposit) && (
        <div className="flex gap-4 px-4 py-2 bg-zinc-900/30 border-b border-zinc-800 text-xs font-mono text-zinc-500">
          {caller && <span>Caller: {caller}</span>}
          {gas && <span>Gas: {gas}</span>}
          {deposit && <span>Deposit: {deposit}</span>}
        </div>
      )}
      <div className="px-4 py-3 text-sm [&>p]:m-0">{children}</div>
    </div>
  );
}
