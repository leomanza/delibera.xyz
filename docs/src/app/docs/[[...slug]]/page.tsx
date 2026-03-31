import { notFound, redirect } from "next/navigation";
import { getDocBySlug, getAllSlugs, extractHeadings, getPrevNext } from "@/lib/content";
import { MDXContent } from "@/lib/mdx";
import { TOC } from "@/components/layout/TOC";
import { DocFooter } from "@/components/layout/DocFooter";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return [
    { slug: undefined }, // /docs root
    ...slugs.map((s) => ({ slug: s })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Delibera Docs" };
  const doc = getDocBySlug(slug);
  if (!doc) return { title: "Not Found" };

  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;

  // /docs root -> redirect to first section
  if (!slug) {
    redirect("/docs/overview");
  }

  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  return renderDoc(doc, slug);
}

function renderDoc(
  doc: { meta: { title: string; description?: string }; content: string },
  slug: string[]
) {
  const headings = extractHeadings(doc.content);
  const { prev, next } = getPrevNext(slug);

  return (
    <>
      <main className="flex-1 min-w-0 px-8 py-8 lg:px-12 lg:py-10">
        <article>
          <MDXContent source={doc.content} />
        </article>
        <DocFooter prev={prev} next={next} />
      </main>
      <TOC headings={headings} />
    </>
  );
}
