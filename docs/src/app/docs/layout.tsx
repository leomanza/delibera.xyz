import { Header } from "@/components/layout/Header";
import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { getNavigation } from "@/lib/content";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = getNavigation();

  return (
    <div className="min-h-screen bg-[#050505] docs-grid">
      <Header />
      <div className="flex max-w-[90rem] mx-auto">
        <div className="hidden lg:block">
          <Sidebar sections={sections} />
        </div>
        <MobileSidebar sections={sections} />
        {children}
      </div>
    </div>
  );
}
