import Link from "next/link";
import type { NavItem } from "@/lib/content";

export function DocFooter({
  prev,
  next,
}: {
  prev: NavItem | null;
  next: NavItem | null;
}) {
  return (
    <div className="mt-12 pt-6 border-t border-zinc-800/80">
      <div className="flex justify-between gap-4">
        {prev ? (
          <Link
            href={prev.href}
            className="group flex-1 flex flex-col items-start p-4 rounded-lg border border-zinc-800/60 hover:border-zinc-700 transition-colors"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
              Previous
            </span>
            <span className="text-sm font-mono text-zinc-400 group-hover:text-[#00ff41] transition-colors">
              &larr; {prev.title}
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={next.href}
            className="group flex-1 flex flex-col items-end p-4 rounded-lg border border-zinc-800/60 hover:border-zinc-700 transition-colors"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
              Next
            </span>
            <span className="text-sm font-mono text-zinc-400 group-hover:text-[#00ff41] transition-colors">
              {next.title} &rarr;
            </span>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
      <div className="mt-8 pb-6 text-center">
        <p className="text-[11px] font-mono text-zinc-700">
          Delibera Protocol &middot;{" "}
          <a
            href="https://github.com/leomanza/near-shade-coordination"
            className="hover:text-zinc-500 transition-colors"
          >
            GitHub
          </a>{" "}
          &middot;{" "}
          <a
            href="https://delibera.xyz"
            className="hover:text-zinc-500 transition-colors"
          >
            delibera.xyz
          </a>
        </p>
      </div>
    </div>
  );
}
