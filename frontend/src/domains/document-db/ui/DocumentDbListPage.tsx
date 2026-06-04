"use client";

import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, Plus } from "@/shared/ui/icons";
import { useDocumentDbs } from "../api/document-db.hooks";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/** A-0: Document DB (domain) dashboard. */
export function DocumentDbListPage() {
  const router = useRouter();
  const { data: documentDbs, isLoading } = useDocumentDbs();

  return (
    <div className="h-screen overflow-y-auto">
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-surface">
        <div>
          <h1 className="text-[15px] font-semibold text-ink tracking-tight leading-tight">Document DB</h1>
          <p className="text-xs text-ink-3 mt-0.5">도메인(문서종류)별 검토 공간</p>
        </div>
        <button type="button" className="tr-btn tr-btn-secondary h-9 px-3">
          <Plus className="w-4 h-4" strokeWidth={1.75} />새 Document DB
        </button>
      </header>

      <div className="px-8 py-7 max-w-5xl">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 tr-card animate-pulse" />
            ))}
          </div>
        ) : !documentDbs || documentDbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-28 text-ink-3">
            <p className="text-sm max-w-xs">아직 Document DB가 없습니다. 첫 도메인을 만들어 문서를 추가하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {documentDbs.map((db) => (
              <div
                key={db.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/document-dbs/${db.id}`)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && router.push(`/document-dbs/${db.id}`)}
                className="group relative tr-card p-5 cursor-pointer transition-[box-shadow,border-color] duration-150 hover:shadow-card hover:border-border-strong"
              >
                <button
                  type="button"
                  title="더보기"
                  onClick={(e) => e.stopPropagation()}
                  className="tr-icon-btn absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
                </button>

                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-9 h-9 rounded-lg bg-surface-muted text-ink-3 shrink-0">
                    <FileText className="w-4 h-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 pr-6">
                    <h2 className="font-semibold text-ink truncate leading-tight">{db.name}</h2>
                    {db.description && <p className="text-xs text-ink-3 truncate mt-0.5">{db.description}</p>}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-ink-3">
                  <span>
                    <span className="text-ink-2 font-medium tabular-nums">{db.documentCount}</span> 문서
                    <span className="mx-1.5 text-border-strong">·</span>
                    <span className="text-ink-2 font-medium tabular-nums">{db.columnCount}</span> 컬럼
                  </span>
                  <span>{formatDate(db.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
