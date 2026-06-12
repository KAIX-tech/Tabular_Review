"use client";

import { ChatSessionList } from "@/domains/chat";
import { KalexLogo } from "@/shared/ui/KalexLogo";
import { ChevronDown, FolderOpen, MessageSquare } from "@/shared/ui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDocumentDbs } from "../api/document-db.hooks";

/**
 * Left sidebar with two collapsible menu groups at the same hierarchy:
 *  - Chat → New Chat + session history
 *  - Document DB → the Document DB list
 *
 * Each header is a toggle: navigating into a section auto-expands its group,
 * clicking the header of the section you're already on collapses/expands it,
 * and both groups can stay open at once.
 */
export function DocumentDbRail() {
  const pathname = usePathname();
  const { data: documentDbs, isLoading } = useDocumentDbs();

  const activeId = pathname.match(/\/document-dbs\/([^/]+)/)?.[1] ?? null;
  const onChat = pathname.startsWith("/chat");
  const onDocs = pathname.startsWith("/document-dbs");

  const [chatOpen, setChatOpen] = useState(onChat);
  const [docsOpen, setDocsOpen] = useState(onDocs);
  // Entering a section always reveals its children (never force-closes the other).
  useEffect(() => {
    if (onChat) setChatOpen(true);
  }, [onChat]);
  useEffect(() => {
    if (onDocs) setDocsOpen(true);
  }, [onDocs]);

  const headerProps = (
    inSection: boolean,
    open: boolean,
    setOpen: (v: boolean) => void,
  ): React.ComponentProps<typeof Link>["onClick"] => {
    return (e) => {
      // Already in the section → the click is a pure toggle, not a navigation.
      if (inSection) {
        e.preventDefault();
        setOpen(!open);
      } else {
        setOpen(true);
      }
    };
  };

  return (
    <aside className="w-60 shrink-0 h-screen bg-surface border-r border-border flex flex-col">
      <Link href="/document-dbs" className="h-16 px-5 flex items-center border-b border-border">
        <KalexLogo />
      </Link>

      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {/* Chat group */}
        <Link
          href="/chat"
          onClick={headerProps(onChat, chatOpen, setChatOpen)}
          className={`tr-nav-item ${onChat ? "is-active" : ""}`}
          aria-expanded={chatOpen}
        >
          <MessageSquare className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>Chat</span>
          <ChevronDown
            className={`ml-auto w-3.5 h-3.5 shrink-0 text-ink-3 transition-transform duration-200 ${
              chatOpen ? "" : "-rotate-90"
            }`}
            strokeWidth={2}
          />
        </Link>
        <div className={`kalex-collapse ${chatOpen ? "is-open" : ""}`} inert={!chatOpen}>
          <div>
            <ChatSessionList />
          </div>
        </div>

        {/* Document DB group */}
        <Link
          href="/document-dbs"
          onClick={headerProps(onDocs, docsOpen, setDocsOpen)}
          className={`tr-nav-item mt-1 ${onDocs ? "is-active" : ""}`}
          aria-expanded={docsOpen}
        >
          <FolderOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span>Document DB</span>
          <ChevronDown
            className={`ml-auto w-3.5 h-3.5 shrink-0 text-ink-3 transition-transform duration-200 ${
              docsOpen ? "" : "-rotate-90"
            }`}
            strokeWidth={2}
          />
        </Link>
        <div className={`kalex-collapse ${docsOpen ? "is-open" : ""}`} inert={!docsOpen}>
          <div className="pl-4 pr-1 py-0.5 space-y-0.5">
            {isLoading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-8 mx-1 rounded-lg bg-surface-muted animate-pulse" />
              ))}
            {documentDbs?.map((db) => {
              const active = db.id === activeId;
              return (
                <Link
                  key={db.id}
                  href={`/document-dbs/${db.id}`}
                  className={`flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                    active
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-ink-2 hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <span className="truncate flex-1">{db.name}</span>
                  <span className="text-[11px] text-ink-3 tabular-nums">{db.documentCount}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
