"use client";

import React, { useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AddColumnMenu,
  ColumnLibrary,
  DataGrid,
  extractColumnData,
  processDocumentToMarkdown,
  VerificationSidebar,
} from "@/domains/document-review";
import type {
  Column,
  ColumnTemplate,
  ColumnType,
  DocumentFile,
  ExtractionResult,
} from "@/domains/document-review";
import { ENV } from "@/shared/config/env";
import type { SidebarMode } from "@/shared/types/view";
import {
  Brain,
  ChevronDown,
  Download,
  FilePlus,
  Loader2,
  Play,
  RefreshCw,
  Square,
  WrapText,
} from "@/shared/ui/icons";
import { useDocumentDb } from "../api/document-db.hooks";

const MODELS = [{ id: ENV.llmModel, name: "GLM-5", description: "On-prem vLLM", icon: Brain }];

/** A-1: the Kalex grid for a single Document DB. */
export const DocumentDbReviewPage: React.FC = () => {
  const params = useParams<{ dbId: string }>();
  const { data: db } = useDocumentDb(params?.dbId ?? "");
  const dbName = db?.name ?? "Document DB";

  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [results, setResults] = useState<ExtractionResult>({});

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("none");
  const [selectedCell, setSelectedCell] = useState<{ docId: string; colId: string } | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const [addColumnAnchor, setAddColumnAnchor] = useState<DOMRect | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isTextWrapEnabled, setIsTextWrapEnabled] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const fileList: File[] = Array.from(event.target.files);
      processUploadedFiles(fileList);
      event.target.value = "";
    }
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setIsConverting(true);
    try {
      const processedFiles: DocumentFile[] = [];
      for (const file of fileList) {
        const markdownContent = await processDocumentToMarkdown(file);
        const contentBase64 = btoa(unescape(encodeURIComponent(markdownContent)));
        processedFiles.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          content: contentBase64,
          mimeType: "text/markdown",
        });
      }
      setDocuments((prev) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error("Failed to process files:", error);
      const message =
        error instanceof Error ? error.message : "Please check if they are valid PDF or DOCX documents.";
      alert(`Error processing some files.\n\n${message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleRemoveDoc = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setResults((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    if (selectedCell?.docId === docId) {
      setSidebarMode("none");
      setSelectedCell(null);
    }
    if (previewDocId === docId) {
      setPreviewDocId(null);
      setSidebarMode("none");
    }
  };

  const handleSaveColumn = (colDef: { name: string; type: ColumnType; prompt: string }) => {
    if (editingColumnId) {
      setColumns((prev) => prev.map((c) => (c.id === editingColumnId ? { ...c, ...colDef } : c)));
      setEditingColumnId(null);
    } else {
      const newCol: Column = {
        id: `col_${Date.now()}`,
        name: colDef.name,
        type: colDef.type,
        prompt: colDef.prompt,
        status: "idle",
        width: 250,
      };
      setColumns((prev) => [...prev, newCol]);
    }
    setAddColumnAnchor(null);
  };

  const handleDeleteColumn = () => {
    if (!editingColumnId) return;
    setColumns((prev) => prev.filter((c) => c.id !== editingColumnId));
    setResults((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((docId) => {
        if (next[docId]?.[editingColumnId]) {
          const docResults = { ...next[docId] };
          delete docResults[editingColumnId];
          next[docId] = docResults;
        }
      });
      return next;
    });
    if (selectedCell?.colId === editingColumnId) {
      setSelectedCell(null);
      setSidebarMode("none");
    }
    setEditingColumnId(null);
    setAddColumnAnchor(null);
  };

  const handleEditColumn = (colId: string, rect: DOMRect) => {
    setEditingColumnId(colId);
    setAddColumnAnchor(rect);
  };

  const handleColumnResize = (colId: string, newWidth: number) => {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, width: newWidth } : c)));
  };

  const handleCloseMenu = () => {
    setAddColumnAnchor(null);
    setEditingColumnId(null);
  };

  const handleSelectTemplate = (template: ColumnTemplate) => {
    const newCol: Column = {
      id: `col_${Date.now()}`,
      name: template.name,
      type: template.type,
      prompt: template.prompt,
      status: "idle",
      width: 250,
    };
    setColumns((prev) => [...prev, newCol]);
    setIsLibraryOpen(false);
  };

  const handleOpenLibrary = () => {
    setAddColumnAnchor(null);
    setIsLibraryOpen(true);
  };

  const handleStopExtraction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  const handleRunAnalysis = () => {
    if (documents.length === 0 || columns.length === 0) return;
    processExtraction(documents, columns);
  };

  const handleRerunSelected = () => {
    if (selectedDocIds.size === 0 || columns.length === 0) return;
    const selectedDocs = documents.filter((d) => selectedDocIds.has(d.id));
    setResults((prev) => {
      const next = { ...prev };
      selectedDocIds.forEach((docId) => {
        delete next[docId];
      });
      return next;
    });
    processExtraction(selectedDocs, columns, true);
  };

  const handleToggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const handleToggleAllDocSelection = () => {
    setSelectedDocIds((prev) =>
      prev.size === documents.length ? new Set() : new Set(documents.map((d) => d.id)),
    );
  };

  const handleExportCSV = () => {
    if (documents.length === 0) return;
    const headerRow = ["Document Name", ...columns.map((c) => c.name)];
    const rows = documents.map((doc) => {
      const rowData = [doc.name];
      columns.forEach((col) => {
        const cell = results[doc.id]?.[col.id];
        const val = cell ? cell.value.replace(/"/g, '""') : "";
        rowData.push(`"${val}"`);
      });
      return rowData.join(",");
    });
    const csvContent = [headerRow.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${dbName.replace(/\s+/g, "_").toLowerCase()}_export.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processExtraction = async (
    docsToProcess: DocumentFile[],
    colsToProcess: Column[],
    forceOverwrite = false,
  ) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true);

    try {
      setColumns((prev) =>
        prev.map((c) => (colsToProcess.some((t) => t.id === c.id) ? { ...c, status: "extracting" } : c)),
      );

      const tasks: { doc: DocumentFile; col: Column }[] = [];
      for (const doc of docsToProcess) {
        for (const col of colsToProcess) {
          if (forceOverwrite || !results[doc.id]?.[col.id]) tasks.push({ doc, col });
        }
      }

      const promises = tasks.map(async ({ doc, col }) => {
        if (controller.signal.aborted) return;
        try {
          const data = await extractColumnData(doc, col, selectedModel);
          if (controller.signal.aborted) return;
          setResults((prev) => ({
            ...prev,
            [doc.id]: { ...(prev[doc.id] || {}), [col.id]: data },
          }));
        } catch (e) {
          console.error(`Failed to extract ${col.name} for ${doc.name}`, e);
        }
      });

      await Promise.all(promises);

      if (!controller.signal.aborted) {
        setColumns((prev) =>
          prev.map((c) => (colsToProcess.some((t) => t.id === c.id) ? { ...c, status: "completed" } : c)),
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsProcessing(false);
        abortControllerRef.current = null;
        setColumns((prev) => prev.map((c) => (c.status === "extracting" ? { ...c, status: "idle" } : c)));
      }
    }
  };

  const handleCellClick = (docId: string, colId: string) => {
    if (results[docId]?.[colId]) {
      setSelectedCell({ docId, colId });
      setPreviewDocId(null);
      setSidebarMode("verify");
      setIsSidebarExpanded(false);
    }
  };

  const handleDocumentClick = (docId: string) => {
    setSelectedCell(null);
    setPreviewDocId(docId);
    setSidebarMode("verify");
    setIsSidebarExpanded(true);
  };

  const handleVerifyCell = () => {
    if (!selectedCell) return;
    const { docId, colId } = selectedCell;
    setResults((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], [colId]: { ...prev[docId][colId]!, status: "verified" } },
    }));
  };

  const getSidebarData = () => {
    if (selectedCell) {
      return {
        cell: results[selectedCell.docId]?.[selectedCell.colId] || null,
        document: documents.find((d) => d.id === selectedCell.docId) || null,
        column: columns.find((c) => c.id === selectedCell.colId) || null,
      };
    }
    if (previewDocId) {
      return { cell: null, document: documents.find((d) => d.id === previewDocId) || null, column: null };
    }
    return null;
  };

  const sidebarData = getSidebarData();
  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  const sidebarWidthClass =
    sidebarMode === "none"
      ? "w-0 translate-x-10 opacity-0 overflow-hidden"
      : isSidebarExpanded
        ? "w-[900px] translate-x-0"
        : "w-[400px] translate-x-0";

  const addDocument = () => !isConverting && fileInputRef.current?.click();

  return (
    <div className="flex flex-col h-full bg-canvas text-ink">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
        accept=".pdf,.txt,.md,.json,.docx"
      />

      {/* Page header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm text-ink-3 shrink-0 hidden lg:inline">Kalex</span>
          <span className="text-ink-3 shrink-0 hidden lg:inline">/</span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-ink truncate leading-tight">{dbName}</h1>
            <p className="text-[11px] text-ink-3 leading-tight whitespace-nowrap">
              문서 {documents.length} · 컬럼 {columns.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-3">
          <button
            type="button"
            onClick={addDocument}
            disabled={isConverting}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink-2 border border-border text-xs font-semibold rounded-lg transition-colors ${
              isConverting ? "opacity-70 cursor-wait" : ""
            }`}
          >
            {isConverting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>변환 중…</span>
              </>
            ) : (
              <>
                <FilePlus className="w-3.5 h-3.5" />
                <span>문서 추가</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsTextWrapEnabled((v) => !v)}
            title="줄바꿈 토글"
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-colors ${
              isTextWrapEnabled
                ? "bg-primary-soft text-primary border-primary/30"
                : "bg-surface hover:bg-surface-muted text-ink-2 border-border"
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={documents.length === 0}
            title="CSV 내보내기"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink-2 border border-border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Model selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => !isProcessing && setIsModelMenuOpen((v) => !v)}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-3 py-1.5 bg-surface-muted text-ink rounded-lg border border-border transition-colors ${
                !isProcessing ? "hover:bg-surface" : "opacity-60 cursor-not-allowed"
              }`}
            >
              <currentModel.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{currentModel.name}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {isModelMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsModelMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-popover border border-border p-1 z-50">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                        selectedModel === model.id ? "bg-primary-soft text-primary" : "hover:bg-surface-muted text-ink-2"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${selectedModel === model.id ? "bg-surface shadow-soft" : "bg-surface-muted"}`}>
                        <model.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{model.name}</div>
                        <div className="text-[10px] opacity-70">{model.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Run / Stop / Re-run */}
          {isProcessing ? (
            <button
              type="button"
              onClick={handleStopExtraction}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-lg transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />중지
            </button>
          ) : selectedDocIds.size > 0 ? (
            <button
              type="button"
              onClick={handleRerunSelected}
              disabled={columns.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />재실행 ({selectedDocIds.size})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={documents.length === 0 || columns.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-ink hover:bg-ink/90 text-white text-xs font-bold rounded-lg transition-colors shadow-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />추출 실행
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex overflow-hidden relative">
        {isConverting && (
          <div className="absolute inset-0 z-50 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-surface p-8 rounded-2xl shadow-2xl border border-primary/20 flex flex-col items-center max-w-md text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
                <div className="relative bg-primary-soft p-4 rounded-full">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2">문서 변환 중</h3>
              <p className="text-ink-2">로컬 Docling 엔진으로 형식과 구조를 보존합니다…</p>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6">
          <div className="flex-1 min-h-0 rounded-xl border border-border bg-surface shadow-soft overflow-hidden">
            <DataGrid
              documents={documents}
              columns={columns}
              results={results}
              onAddColumn={(rect) => setAddColumnAnchor(rect)}
              onEditColumn={handleEditColumn}
              onColumnResize={handleColumnResize}
              onCellClick={handleCellClick}
              onDocClick={handleDocumentClick}
              onRemoveDoc={handleRemoveDoc}
              selectedCell={selectedCell}
              isTextWrapEnabled={isTextWrapEnabled}
              onDropFiles={(files) => processUploadedFiles(files)}
              selectedDocIds={selectedDocIds}
              onToggleDocSelection={handleToggleDocSelection}
              onToggleAllDocSelection={handleToggleAllDocSelection}
            />
          </div>
        </div>

        {addColumnAnchor && (
          <AddColumnMenu
            triggerRect={addColumnAnchor}
            onClose={handleCloseMenu}
            onSave={handleSaveColumn}
            onDelete={handleDeleteColumn}
            modelId={selectedModel}
            initialData={editingColumnId ? columns.find((c) => c.id === editingColumnId) : undefined}
            onOpenLibrary={handleOpenLibrary}
          />
        )}

        <ColumnLibrary
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          onSelectTemplate={handleSelectTemplate}
        />

        <div
          className={`transition-colors duration-300 ease-in-out border-l border-border bg-surface shadow-popover z-30 relative ${sidebarWidthClass}`}
        >
          <div className="w-full h-full absolute right-0 top-0 flex flex-col">
            {sidebarMode === "verify" && sidebarData && (
              <VerificationSidebar
                cell={sidebarData.cell}
                document={sidebarData.document}
                column={sidebarData.column}
                onClose={() => {
                  setSidebarMode("none");
                  setSelectedCell(null);
                  setPreviewDocId(null);
                }}
                onVerify={handleVerifyCell}
                isExpanded={isSidebarExpanded}
                onExpand={setIsSidebarExpanded}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
