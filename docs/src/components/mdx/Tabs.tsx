"use client";

import { useState } from "react";

export function Tabs({
  items,
  children,
}: {
  items: string[];
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="my-5 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {items.map((item, i) => (
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
      <div className="p-4">{Array.isArray(children) ? children[active] : children}</div>
    </div>
  );
}
