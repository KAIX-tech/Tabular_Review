"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, MoreHorizontal, Plus, Trash2, X } from "@/shared/ui/icons";
import {
  useCreateDocumentDb,
  useDeleteDocumentDb,
  useDocumentDbs,
} from "../api/document-db.hooks";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

/** A-0: Document DB (domain) dashboard. */
export function DocumentDbListPage() {
  const router = useRouter();
  const { data: documentDbs, isLoading } = useDocumentDbs();
  const createMutation = useCreateDocumentDb();
  const deleteMutation = useDeleteDocumentDb();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  // Close the per-card actions menu on Escape or outside click.
  useEffect(() => {
    if (!menuId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuId(null);
    const onPointer = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-card-menu]")) setMenuId(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuId]);

  const handleDelete = (id: string) => {
    setMenuId(null);
    deleteMutation.mutate(id);
  };

  return (
    <div className="h-screen overflow-y-auto">
      <header className="h-16 px-8 flex items-center justify-between border-b border-border bg-surface">
        <div>
          <h1 className="text-[15px] font-semibold text-ink tracking-tight leading-tight">Document DB</h1>
          <p className="text-xs text-ink-3 mt-0.5">도메인(문서종류)별 검토 공간</p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="tr-btn tr-btn-secondary h-9 px-3"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />새 Document DB
        </button>
      </header>

      <div className="px-8 py-7 max-w-5xl">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 tr-card animate-pulse" />
            ))}
          </div>
        ) : !documentDbs || documentDbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-28 text-ink-3">
            <p className="text-sm max-w-xs">아직 Document DB가 없습니다. 첫 도메인을 만들어 문서를 추가하세요.</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="tr-btn tr-btn-secondary h-9 px-3 mt-5"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />새 Document DB
            </button>
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
                <div data-card-menu className="absolute top-3.5 right-3.5">
                  <button
                    type="button"
                    title="더보기"
                    data-open={menuId === db.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(menuId === db.id ? null : db.id);
                    }}
                    onKeyDown={(e) => {
                      // Don't let Enter/Space bubble to the card link handler.
                      if (e.key === "Enter" || e.key === " ") e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="tr-icon-btn opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  {menuId === db.id && (
                    <div className="absolute right-0 top-9 z-10 w-32 tr-card shadow-popover p-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(db.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="tr-btn tr-btn-danger w-full h-8 px-2 justify-start text-sm"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />삭제
                      </button>
                    </div>
                  )}
                </div>

                <div className="pr-6">
                  <h2 className="font-semibold text-ink truncate leading-tight">{db.name}</h2>
                  {db.description && <p className="text-[13px] text-ink-3 truncate mt-1">{db.description}</p>}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-ink-3">
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

      {dialogOpen && (
        <NewDocumentDbDialog
          pending={createMutation.isPending}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values) =>
            createMutation.mutate(values, { onSuccess: () => setDialogOpen(false) })
          }
        />
      )}
    </div>
  );
}

function NewDocumentDbDialog({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    onSubmit({ name: trimmed, description: description.trim() || undefined });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md tr-card shadow-popover p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink tracking-tight">새 Document DB</h2>
          <button type="button" onClick={onClose} className="tr-icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-ink-3 mt-1">하나의 도메인(문서종류)을 만듭니다.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="db-name" className="tr-label">
              이름
            </label>
            <input
              id="db-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="예: 계약서"
              className="tr-input mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="db-desc" className="tr-label">
              설명 <span className="font-normal normal-case text-ink-3">(선택)</span>
            </label>
            <input
              id="db-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="예: 상용 계약서 검토 문서 모음"
              className="tr-input mt-1.5"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="tr-btn tr-btn-secondary h-9 px-3.5">
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || pending}
            className="tr-btn tr-btn-primary h-9 px-4"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
