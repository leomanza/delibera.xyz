"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavSection } from "@/lib/content";

const sectionIcons: Record<string, string> = {
  overview: "~",
  architecture: "#",
  contracts: "{}",
  identity: "@",
  guides: ">",
  api: "/",
  "near-ai": "*",
  security: "!",
  "tech-stack": "+",
  roadmap: ">>",
};

export function Sidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (slug: string) => {
    setCollapsed((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  return (
    <nav className="w-64 shrink-0 border-r border-zinc-800/80 bg-[#080808] overflow-y-auto h-[calc(100vh-49px)] sticky top-[49px]">
      <div className="py-4">
        {sections.map((section) => {
          const isCollapsed = collapsed[section.slug];
          const hasActive = section.pages.some((p) => pathname === p.href);

          return (
            <div key={section.slug} className="mb-1">
              <button
                onClick={() => toggle(section.slug)}
                className={`w-full flex items-center gap-2.5 px-5 py-2 text-xs font-mono transition-colors ${
                  hasActive
                    ? "text-[#00ff41]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="text-zinc-700 w-4 text-right">
                  {sectionIcons[section.slug] || "·"}
                </span>
                <span className="font-semibold uppercase tracking-wider">
                  {section.title}
                </span>
                <span className="ml-auto text-zinc-700">
                  {isCollapsed ? "+" : "−"}
                </span>
              </button>

              {!isCollapsed && (
                <div className="ml-5 border-l border-zinc-800/60">
                  {section.pages.map((page) => {
                    const isActive = pathname === page.href;
                    return (
                      <Link
                        key={page.href}
                        href={page.href}
                        className={`block pl-5 pr-4 py-1.5 text-[13px] font-mono transition-colors ${
                          isActive
                            ? "text-[#00ff41] bg-[#00ff41]/5 border-r-2 border-[#00ff41]"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {page.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileSidebar({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-4 left-4 z-50 w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-[#00ff41] transition-colors"
        aria-label="Toggle navigation"
      >
        <span className="font-mono text-sm">{open ? "×" : "≡"}</span>
      </button>
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-[49px] z-40 h-[calc(100vh-49px)]">
            <Sidebar sections={sections} />
          </div>
        </>
      )}
    </>
  );
}
