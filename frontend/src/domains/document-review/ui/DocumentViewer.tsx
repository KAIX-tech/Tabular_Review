"use client";

import { Download, FileText, Loader2, X } from "@/shared/ui/icons";
import type React from "react";
import { useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { documentFileUrl } from "../api/documents.api";
import { useDocumentContent } from "../api/documents.hooks";
import { useQuoteHighlight } from "../lib/use-quote-highlight";
import type { DocumentStatus } from "../model/types";

// Map Markdown elements to styled, readable document typography.
// Shared with the verification sidebar's document pane (same 원문 convention).
export const DOC_MD_COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="text-lg font-semibold text-ink mt-5 mb-2">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-ink mt-5 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="text-sm font-semibold text-ink mt-4 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-[15px] leading-relaxed text-ink-2 my-2">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1 text-[15px] text-ink-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1 text-[15px] text-ink-2">{children}</ol>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  // Wrap in a horizontal scroller so wide tables don't overflow the panel.
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 bg-surface-muted text-left align-top">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

interface DocumentViewerProps {
  documentId: string;
  name: string;
  status: DocumentStatus;
  onClose: () => void;
  /** Quoted passage to highlight + scroll to (e.g. a chat chunk citation). */
  highlightQuote?: string | null;
}

/** Right-panel viewer for an ingested document: shows the converted Markdown and
 *  a link to the original file. Content is fetched once the document is ready. */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  name,
  status,
  onClose,
  highlightQuote,
}) => {
  const isReady = status === "ready";
  const { data: markdown, isLoading } = useDocumentContent(documentId, isReady);
  const articleRef = useRef<HTMLElement>(null);
  useQuoteHighlight(articleRef, markdown, highlightQuote);

  return (
    <div className="flex flex-col h-full bg-surface">
      <header className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} />
          <span className="text-sm font-medium text-ink truncate" title={name}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={documentFileUrl(documentId)}
            target="_blank"
            rel="noopener noreferrer"
            title="원본 파일"
            className="tr-icon-btn"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
          </a>
          <button type="button" onClick={onClose} className="tr-icon-btn" title="닫기">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {!isReady ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-ink-3 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm">문서를 처리하는 중입니다… (상태: {status})</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-ink-3">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : markdown ? (
          <article ref={articleRef} className="max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={DOC_MD_COMPONENTS}>
              {markdown}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-ink-3">표시할 내용이 없습니다.</p>
        )}
      </div>
    </div>
  );
};
