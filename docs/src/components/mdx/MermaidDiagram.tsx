"use client";

import { useEffect, useRef, useState } from "react";

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#0a0f0a",
          primaryColor: "#00ff41",
          primaryTextColor: "#c8c8c8",
          primaryBorderColor: "#00ff41",
          lineColor: "#3f3f46",
          secondaryColor: "#1a1a1a",
          tertiaryColor: "#0a0f0a",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "13px",
        },
      });
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid.render(id, chart).then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (!svg) {
    return (
      <div className="my-5 p-6 border border-zinc-800 rounded-lg bg-zinc-900/30 text-center text-xs text-zinc-600 font-mono">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="my-5 p-4 border border-zinc-800 rounded-lg bg-[#0a0f0a] overflow-x-auto [&>svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
