"use client";

import { useState, Children } from "react";

export function Tab({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tabs({
  items,
  children,
}: {
  items?: string[];
  children?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);
  const labels = items ?? tabs.map((_, i) => `Tab ${i + 1}`);

  if (labels.length === 0) return null;

  return (
    <div className="my-5 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {labels.map((item, i) => (
          <button
            key={item}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-xs font-mono transition-colors ${
              active === i
                ? "text-[#00ff41] bg-[#00ff41]/5 border-b-2 border-[#00ff41]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="p-4">{tabs[active] ?? tabs[0]}</div>
    </div>
  );
}
