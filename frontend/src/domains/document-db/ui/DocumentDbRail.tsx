"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatSessionList } from "@/domains/chat";
import { FolderOpen, MessageSquare } from "@/shared/ui/icons";
import { KalexLogo } from "@/shared/ui/KalexLogo";
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

  return (
    <aside className="w-60 shrink-0 h-screen bg-surface border-r border-border flex flex-col">
      <Link href="/document-dbs" className="h-16 px-5 flex items-center border-b border-border">
        <KalexLogo />
      </Link>

      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {/* Chat tab */}
        <Link href="/chat" className={`tr-nav-item ${onChat ? "is-active" : ""}`}>
          <MessageSquare className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>Chat</span>
          <span className="ml-auto text-[10px] text-ink-3">전체 DB</span>
        </Link>
        {onChat && <ChatSessionList />}

        {/* Document DB tab */}
        <Link href="/document-dbs" className={`tr-nav-item mt-1 ${onDocs ? "is-active" : ""}`}>
          <FolderOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>Document DB</span>
          {documentDbs && (
            <span className="ml-auto text-[10px] text-ink-3 tabular-nums">{documentDbs.length}</span>
          )}
        </Link>
        {onDocs && (
          <div className="pl-4 pr-1 py-0.5 space-y-0.5">
            {isLoading &&
              [0, 1, 2].map((i) => <div key={i} className="h-8 mx-1 rounded-lg bg-surface-muted animate-pulse" />)}
            {documentDbs?.map((db) => {
              const active = db.id === activeId;
              return (
                <Link
                  key={db.id}
                  href={`/document-dbs/${db.id}`}
                  className={`flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                    active ? "bg-primary-soft text-primary font-medium" : "text-ink-2 hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <span className="truncate flex-1">{db.name}</span>
                  <span className="text-[11px] text-ink-3 tabular-nums">{db.documentCount}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
