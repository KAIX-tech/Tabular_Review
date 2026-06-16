"use client";

import { FileText, Loader2, X } from "@/shared/ui/icons";
import type React from "react";
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocumentContent } from "../api/documents.hooks";
import { useQuoteHighlight } from "../lib/use-quote-highlight";
import type { Column, DocumentFile, ExtractionCell } from "../model/types";
import { CellDetailCard } from "./CellDetailCard";
import { DOC_MD_COMPONENTS } from "./DocumentViewer";

interface VerificationSidebarProps {
  cell?: ExtractionCell | null;
  document: DocumentFile | null;
  column?: Column | null;
  onClose: () => void;
  onVerify?: () => void;
  /** Correct a single_select cell's value via the constrained dropdown. */
  onEditValue?: (value: string) => void;
  isExpanded: boolean;
  onExpand: (expanded: boolean) => void;
}

/** Decode the legacy mock-mode base64 payload (real mode fetches by id). */
function decodeBase64Content(content: string): string {
  try {
    const clean = content.replace(/^data:.*;base64,/, "");
    const binary = atob(clean);
    try {
      return decodeURIComponent(escape(binary));
    } catch {
      return binary;
    }
  } catch {
    return "";
  }
}

/**
 * Cell verification panel (A-4): cell detail on the left (shared
 * CellDetailCard), and — when expanded — the document markdown on the right
 * with the cited passage highlighted, using the same viewer/highlight
 * convention as every other 원문 참조 surface.
 */
export const VerificationSidebar: React.FC<VerificationSidebarProps> = ({
  cell,
  document,
  column,
  onClose,
  onEditValue,
  isExpanded,
  onExpand,
}) => {
  // Real mode: document.content is empty — fetch markdown by id. Mock mode:
  // decode the inline base64 payload.
  const inlineContent = document?.content ? decodeBase64Content(document.content) : "";
  const { data: fetchedContent, isLoading } = useDocumentContent(
    document?.id ?? "",
    isExpanded && !!document && !inlineContent,
  );
  const markdown = inlineContent || fetchedContent || "";

  const articleRef = useRef<HTMLElement>(null);
  useQuoteHighlight(articleRef, isExpanded ? markdown : null, cell?.quote);

  if (!document) return null;

  return (
    <div className="h-full w-full flex">
      {/* Left panel: cell detail (shared card) */}
      <div
        className={`${isExpanded ? "w-[400px]" : "w-full"} flex-shrink-0 transition-all duration-300 z-20 flex flex-col bg-surface border-r border-border`}
      >
        <header className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} />
            <div className="flex flex-col min-w-0">
              <span className="tr-label">{cell ? "셀 검증" : "문서 미리보기"}</span>
              <span className="text-sm font-medium text-ink truncate" title={document.name}>
                {document.name}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="tr-icon-btn" title="닫기">
            <X className="w-4 h-4" />
          </button>
        </header>

        {cell && column ? (
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            <CellDetailCard
              data={{
                columnName: column.name,
                columnType: column.type,
                value: cell.value,
                valueJson: cell.valueJson,
                confidence: cell.confidence ?? null,
                reasoning: cell.reasoning,
                quote: cell.quote,
                page: cell.page || null,
              }}
              onOpenSource={() => onExpand(true)}
            />
            {/* single_select: constrained correction dropdown (controlled vocab). */}
            {column.type === "single_select" && column.options && column.options.length > 0 && (
              <div className="space-y-1.5">
                <span className="tr-label">분류 수정</span>
                <select
                  value={cell.value}
                  onChange={(e) => onEditValue?.(e.target.value)}
                  disabled={!onEditValue}
                  className="w-full border border-border rounded-lg px-2.5 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {!column.options.includes(cell.value) && (
                    <option value={cell.value}>{cell.value || "(미분류)"}</option>
                  )}
                  {column.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center flex-1 text-center gap-3">
            <FileText className="w-10 h-10 text-border-strong" strokeWidth={1.5} />
            <p className="text-sm text-ink-3">문서 미리보기</p>
            {!isExpanded && (
              <button
                type="button"
                onClick={() => onExpand(true)}
                className="tr-btn tr-btn-secondary h-8 text-xs"
              >
                문서 열기
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right panel: document markdown with the cited passage highlighted */}
      {isExpanded && (
        <div className="flex-1 min-w-0 flex flex-col bg-canvas">
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-ink-3">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : markdown ? (
              <article ref={articleRef} className="max-w-[800px] mx-auto break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={DOC_MD_COMPONENTS}>
                  {markdown}
                </ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm text-ink-3 text-center mt-10">표시할 내용이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
