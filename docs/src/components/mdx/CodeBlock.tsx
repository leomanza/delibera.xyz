"use client";

import { useState } from "react";

export function CodeBlock({
  html,
  language,
  filename,
}: {
  html: string;
  language?: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = temp.textContent || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-5">
      {(filename || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0f0a] border border-b-0 border-[rgba(0,255,65,0.1)] rounded-t-lg">
          {filename && (
            <span className="text-xs font-mono text-zinc-500">{filename}</span>
          )}
          {language && !filename && (
            <span className="text-xs font-mono text-zinc-600">{language}</span>
          )}
          <button
            onClick={copyCode}
            className="text-xs font-mono text-zinc-600 hover:text-[#00ff41] transition-colors"
          >
            {copied ? "[copied]" : "[copy]"}
          </button>
        </div>
      )}
      <div
        className={`[&>pre]:!m-0 [&>pre]:!rounded-t-none ${
          !filename && !language ? "[&>pre]:!rounded-lg" : ""
        } [&>pre]:border [&>pre]:border-[rgba(0,255,65,0.1)] [&>pre]:!bg-[#0a0f0a]`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {!filename && !language && (
        <button
          onClick={copyCode}
          className="absolute top-3 right-3 text-xs font-mono text-zinc-600 hover:text-[#00ff41] transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? "[copied]" : "[copy]"}
        </button>
      )}
    </div>
  );
}
