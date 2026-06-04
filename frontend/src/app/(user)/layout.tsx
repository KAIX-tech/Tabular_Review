import { DocumentDbRail } from "@/domains/document-db";

// User shell: same left rail (read-only in user surface) + content area.
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <DocumentDbRail />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
