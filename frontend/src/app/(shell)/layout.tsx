import { DocumentDbRail } from "@/domains/document-db";

// App shell: left sidebar (Chat + Document DB switcher) + content area.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-canvas">
      <DocumentDbRail />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
