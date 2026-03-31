import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#050505]/90 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-3 max-w-[90rem] mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/docs" className="flex items-center gap-2.5">
            <img src="/logo-iso.svg" alt="Delibera" className="h-6 w-6" />
            <span className="text-sm font-bold text-zinc-100 font-mono">
              Delibera
            </span>
            <span className="text-xs font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
              docs
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://delibera.xyz"
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono hidden sm:block"
          >
            [home]
          </a>
          <a
            href="https://delibera.xyz/dashboard"
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono hidden sm:block"
          >
            [dashboard]
          </a>
          <a
            href="https://github.com/leomanza/near-shade-coordination"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono"
          >
            [github]
          </a>
          <a
            href="https://delibera.xyz/buy"
            className="text-xs px-3 py-1.5 rounded border border-[#00ff41]/20 text-[#00ff41]/80
                       hover:border-[#00ff41]/50 hover:text-[#00ff41] transition-all font-mono
                       hover:shadow-[0_0_12px_rgba(0,255,65,0.1)]"
          >
            deploy
          </a>
        </div>
      </div>
    </header>
  );
}
