import { DocumentDbRail } from "@/domains/document-db";

// Admin shell: left Document DB rail + content area (the 3-pane shell; the right
// sidebar lives inside the grid screen itself).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <DocumentDbRail />
      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
