"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatSessionList } from "@/domains/chat";
import { FileText, FolderOpen, MessageSquare, Table } from "@/shared/ui/icons";
import { useDocumentDbs } from "../api/document-db.hooks";

/**
 * Left sidebar with two peer menu tabs at the same hierarchy:
 *  - Chat → expands to New Chat + session history (when active)
 *  - Document DB → expands to the Document DB list (when active)
 */
export function DocumentDbRail() {
  const pathname = usePathname();
  const { data: documentDbs, isLoading } = useDocumentDbs();

  const activeId = pathname.match(/\/document-dbs\/([^/]+)/)?.[1] ?? null;
  const onChat = pathname.startsWith("/chat");
  const onDocs = pathname.startsWith("/document-dbs");

  const tabClass = (active: boolean) =>
    `flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
      active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <aside className="w-60 shrink-0 h-screen border-r border-slate-200 bg-white flex flex-col">
      <Link
        href="/document-dbs"
        className="h-16 px-4 flex items-center gap-2 border-b border-slate-100 hover:bg-slate-50"
      >
        <div className="p-1.5 bg-indigo-600 rounded-md text-white">
          <Table className="w-4 h-4" />
        </div>
        <span className="font-bold text-slate-800 tracking-tight">Tabular Review</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Chat tab */}
        <Link href="/chat" className={tabClass(onChat)}>
          <MessageSquare className={`w-4 h-4 shrink-0 ${onChat ? "text-indigo-600" : "text-slate-400"}`} />
          <span>Chat</span>
          <span className="ml-auto text-[10px] text-slate-400">전체 DB</span>
        </Link>
        {onChat && <ChatSessionList />}

        {/* Document DB tab */}
        <Link href="/document-dbs" className={`mt-1 ${tabClass(onDocs)}`}>
          <FolderOpen className={`w-4 h-4 shrink-0 ${onDocs ? "text-indigo-600" : "text-slate-400"}`} />
          <span>Document DB</span>
          {documentDbs && (
            <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{documentDbs.length}</span>
          )}
        </Link>
        {onDocs && (
          <div className="pl-3 pr-1 pb-1 space-y-0.5">
            {isLoading &&
              [0, 1, 2].map((i) => <div key={i} className="h-8 mx-1 rounded-md bg-slate-100 animate-pulse" />)}
            {documentDbs?.map((db) => {
              const active = db.id === activeId;
              return (
                <Link
                  key={db.id}
                  href={`/document-dbs/${db.id}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                    active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? "text-indigo-500" : "text-slate-300"}`} />
                  <span className="truncate flex-1">{db.name}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{db.documentCount}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
