"use client";

import { useEffect, useState } from "react";

interface Heading {
  text: string;
  level: number;
  id: string;
}

export function TOC({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="w-56 shrink-0 hidden xl:block">
      <div className="sticky top-[65px] overflow-y-auto max-h-[calc(100vh-80px)] py-6 pr-4">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3 px-3">
          On this page
        </p>
        <nav className="space-y-0.5">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className={`block text-[12px] font-mono py-1 transition-colors ${
                h.level === 3 ? "pl-6" : h.level === 4 ? "pl-9" : "pl-3"
              } ${
                activeId === h.id
                  ? "text-[#00ff41]"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
