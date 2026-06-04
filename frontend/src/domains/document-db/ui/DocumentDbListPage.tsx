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
    <div className="h-screen overflow-y-auto bg-slate-50">
      <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200 bg-white">
        <h1 className="text-lg font-bold text-slate-800">Document DB</h1>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />새 Document DB
        </button>
      </header>

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : !documentDbs || documentDbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm max-w-xs">
              아직 Document DB가 없습니다. 첫 도메인을 만들어 문서를 추가하세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentDbs.map((db) => (
              <div
                key={db.id}
                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-800 truncate">{db.name}</h2>
                    {db.description && (
                      <p className="text-xs text-slate-500 truncate">{db.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span>문서 {db.documentCount}</span>
                  <span className="text-slate-300">·</span>
                  <span>컬럼 {db.columnCount}</span>
                  <span className="text-slate-300">·</span>
                  <span>최종수정 {formatDate(db.updatedAt)}</span>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Link
                    href={`/document-dbs/${db.id}`}
                    className="flex-1 text-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-md transition-colors"
                  >
                    열기
                  </Link>
                  <button
                    type="button"
                    title="설정"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="삭제"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
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
