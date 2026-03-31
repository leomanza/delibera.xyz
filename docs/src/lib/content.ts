import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface DocMeta {
  title: string;
  description?: string;
  slug: string[];
  order?: number;
}

export interface DocPage {
  meta: DocMeta;
  content: string;
}

export interface NavSection {
  title: string;
  slug: string;
  order: number;
  pages: NavItem[];
}

export interface NavItem {
  title: string;
  slug: string;
  href: string;
  order: number;
}

function readMeta(dir: string): { title: string; pages: string[] } | null {
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export function getDocBySlug(slug: string[]): DocPage | null {
  // Try exact path first
  const candidates = [
    path.join(CONTENT_DIR, ...slug) + ".mdx",
    path.join(CONTENT_DIR, ...slug, "index.mdx"),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      return {
        meta: {
          title: data.title || slug[slug.length - 1],
          description: data.description,
          slug,
          order: data.order,
        },
        content,
      };
    }
  }

  return null;
}

export function getAllSlugs(): string[][] {
  const slugs: string[][] = [];

  function walk(dir: string, prefix: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.name.endsWith(".mdx")) {
        const name = entry.name.replace(".mdx", "");
        if (name === "index") {
          slugs.push(prefix.length > 0 ? prefix : []);
        } else {
          slugs.push([...prefix, name]);
        }
      }
    }
  }

  walk(CONTENT_DIR, []);
  return slugs;
}

export function getNavigation(): NavSection[] {
  const sections: NavSection[] = [];
  const entries = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });

  // Collect directories as sections
  const dirs = entries.filter((e) => e.isDirectory());

  // Define section order
  const sectionOrder: Record<string, number> = {
    overview: 0,
    architecture: 1,
    contracts: 2,
    identity: 3,
    guides: 4,
    api: 5,
    "near-ai": 6,
    security: 7,
    "tech-stack": 8,
    roadmap: 9,
  };

  for (const dir of dirs) {
    const dirPath = path.join(CONTENT_DIR, dir.name);
    const meta = readMeta(dirPath);
    const title = meta?.title || formatTitle(dir.name);

    const pages: NavItem[] = [];
    const pageFiles = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".mdx"));

    // Determine page order from meta.json or frontmatter
    const pageOrder = meta?.pages || [];

    for (const file of pageFiles) {
      const name = file.replace(".mdx", "");
      const filePath = path.join(dirPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(raw);

      const pageSlug = name === "index" ? dir.name : `${dir.name}/${name}`;
      const orderIdx = pageOrder.indexOf(name);

      pages.push({
        title: data.title || formatTitle(name === "index" ? dir.name : name),
        slug: name,
        href: `/docs/${pageSlug}`,
        order:
          orderIdx >= 0 ? orderIdx : data.order ?? 100 + pageFiles.indexOf(file),
      });
    }

    pages.sort((a, b) => a.order - b.order);

    sections.push({
      title,
      slug: dir.name,
      order: sectionOrder[dir.name] ?? 99,
      pages,
    });
  }

  sections.sort((a, b) => a.order - b.order);
  return sections;
}

function formatTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function extractHeadings(
  content: string
): { text: string; level: number; id: string }[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: { text: string; level: number; id: string }[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].replace(/`([^`]+)`/g, "$1").trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    headings.push({
      text,
      level: match[1].length,
      id,
    });
  }

  return headings;
}

export function getPrevNext(
  currentSlug: string[]
): { prev: NavItem | null; next: NavItem | null } {
  const nav = getNavigation();
  const allPages: NavItem[] = [];

  for (const section of nav) {
    allPages.push(...section.pages);
  }

  const currentHref = `/docs/${currentSlug.join("/")}`;
  const idx = allPages.findIndex((p) => p.href === currentHref);

  return {
    prev: idx > 0 ? allPages[idx - 1] : null,
    next: idx < allPages.length - 1 ? allPages[idx + 1] : null,
  };
}
