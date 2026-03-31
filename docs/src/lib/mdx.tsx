import { MDXRemote } from "next-mdx-remote/rsc";
import { highlightCode } from "./highlight";
import { Callout } from "@/components/mdx/Callout";
import { ApiMethod } from "@/components/mdx/ApiMethod";
import { Tabs } from "@/components/mdx/Tabs";
import { MermaidDiagram } from "@/components/mdx/MermaidDiagram";
import { CodeBlock } from "@/components/mdx/CodeBlock";

async function Pre({
  children,
  ...props
}: React.ComponentPropsWithoutRef<"pre">) {
  const codeEl = children as React.ReactElement<{
    className?: string;
    children?: string;
  }>;

  if (!codeEl?.props?.children) {
    return <pre {...props}>{children}</pre>;
  }

  const code = codeEl.props.children.trim();
  const lang = codeEl.props.className?.replace("language-", "") || "text";
  const html = await highlightCode(code, lang);

  return <CodeBlock html={html} language={lang} />;
}

function Heading({
  level,
  children,
  ...props
}: {
  level: 1 | 2 | 3 | 4;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  const text =
    typeof children === "string"
      ? children
      : (children as any)?.toString?.() || "";
  const id = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  const Tag = `h${level}` as const;

  return (
    <Tag id={id} {...props}>
      <a href={`#${id}`} className="no-underline hover:no-underline !border-none">
        {children}
      </a>
    </Tag>
  );
}

const components = {
  h2: (props: any) => <Heading level={2} {...props} />,
  h3: (props: any) => <Heading level={3} {...props} />,
  h4: (props: any) => <Heading level={4} {...props} />,
  pre: Pre,
  Callout,
  ApiMethod,
  Tabs,
  MermaidDiagram,
};

export function MDXContent({ source }: { source: string }) {
  return (
    <div className="prose">
      <MDXRemote source={source} components={components} />
    </div>
  );
}
