"use client";

import Link from "next/link";
import { FileText, Plus, Settings, Trash2 } from "@/shared/ui/icons";
import { useDocumentDbs } from "../api/document-db.hooks";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

/** A-0: Document DB (domain) dashboard. */
export function DocumentDbListPage() {
  const { data: documentDbs, isLoading } = useDocumentDbs();

  return (
    <div className="h-screen overflow-y-auto">
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-surface">
        <div>
          <h1 className="text-base font-semibold text-ink tracking-tight leading-tight">Document DB</h1>
          <p className="text-xs text-ink-2">도메인(문서종류)별 검토 공간</p>
        </div>
        <button type="button" className="tr-btn tr-btn-primary h-9 px-4">
          <Plus className="w-4 h-4" />새 Document DB
        </button>
      </header>

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 tr-card animate-pulse" />
            ))}
          </div>
        ) : !documentDbs || documentDbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 text-ink-3">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm max-w-xs">아직 Document DB가 없습니다. 첫 도메인을 만들어 문서를 추가하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {documentDbs.map((db) => (
              <div
                key={db.id}
                className="group tr-card p-5 flex flex-col transition-[box-shadow,border-color] duration-150 hover:shadow-card hover:border-border-strong"
              >
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-lg bg-primary-soft text-primary shrink-0">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="font-semibold text-ink truncate leading-tight">{db.name}</h2>
                    {db.description && <p className="text-xs text-ink-2 truncate mt-0.5">{db.description}</p>}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-ink-2">
                  <span className="tabular-nums">문서 {db.documentCount}</span>
                  <span className="text-border-strong">·</span>
                  <span className="tabular-nums">컬럼 {db.columnCount}</span>
                  <span className="text-border-strong">·</span>
                  <span>최종수정 {formatDate(db.updatedAt)}</span>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Link
                    href={`/document-dbs/${db.id}`}
                    className="tr-btn flex-1 h-9 bg-ink text-white hover:bg-ink/90"
                  >
                    열기
                  </Link>
                  <button type="button" title="설정" className="tr-icon-btn h-9 w-9">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button type="button" title="삭제" className="tr-icon-btn h-9 w-9 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
