import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["vitesse-dark"],
      langs: [
        "typescript",
        "javascript",
        "rust",
        "solidity",
        "json",
        "bash",
        "toml",
        "yaml",
        "tsx",
        "jsx",
        "markdown",
      ],
    });
  }
  return highlighter;
}

export async function highlightCode(
  code: string,
  lang: string
): Promise<string> {
  const hl = await getHighlighter();
  const supported = hl.getLoadedLanguages();
  const language = supported.includes(lang as any) ? lang : "text";

  return hl.codeToHtml(code, {
    lang: language,
    theme: "vitesse-dark",
  });
}
