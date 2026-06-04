"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Plus, Table } from "@/shared/ui/icons";
import { useDocumentDbs } from "../api/document-db.hooks";

/**
 * Left rail: Document DB (domain) switcher — the primary navigation in the flat IA.
 * Surface is derived from the route: "/chat/*" is the user surface (links to chat),
 * everything else is the admin surface (links to the review grid).
 */
export function DocumentDbRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: documentDbs, isLoading } = useDocumentDbs();

  const surface = pathname.startsWith("/chat") ? "user" : "admin";
  const activeId = pathname.match(/\/(?:document-dbs|chat)\/([^/]+)/)?.[1] ?? null;
  const homeHref = surface === "user" ? "/chat" : "/document-dbs";
  const onList = pathname === homeHref;
  const dbHref = (id: string) => (surface === "user" ? `/chat/${id}` : `/document-dbs/${id}`);

  const switchSurface = (target: "admin" | "user") => {
    if (target === "admin") {
      router.push("/document-dbs");
    } else {
      const id = activeId ?? documentDbs?.[0]?.id;
      router.push(id ? `/chat/${id}` : "/chat");
    }
  };

  return (
    <aside className="w-60 shrink-0 h-screen border-r border-slate-200 bg-white flex flex-col">
      <Link
        href={homeHref}
        className={`h-16 px-4 flex items-center gap-2 border-b border-slate-100 ${
          onList ? "bg-slate-50" : "hover:bg-slate-50"
        }`}
      >
        <div className="p-1.5 bg-indigo-600 rounded-md text-white">
          <Table className="w-4 h-4" />
        </div>
        <span className="font-bold text-slate-800 tracking-tight">Tabular Review</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Document DB
        </p>
        {isLoading && (
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 mx-1 rounded-md bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}
        {documentDbs?.map((db) => {
          const active = db.id === activeId;
          return (
            <Link
              key={db.id}
              href={dbHref(db.id)}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
              <span className="truncate">{db.name}</span>
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{db.documentCount}</span>
            </Link>
          );
        })}
      </nav>

      {surface === "admin" && (
        <div className="p-2 border-t border-slate-100">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 border border-dashed border-slate-300 rounded-md hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />새 Document DB
          </button>
        </div>
      )}

      {/* Dev-only surface switch (auth is out of scope for the prototype). */}
      <div className="p-2 border-t border-slate-100 flex items-center gap-1 text-[11px]">
        <span className="text-slate-400 px-1">화면</span>
        {(["admin", "user"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => switchSurface(s)}
            className={`flex-1 px-2 py-1 rounded transition-colors ${
              surface === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {s === "admin" ? "관리자" : "사용자"}
          </button>
        ))}
      </div>
    </aside>
  );
}
