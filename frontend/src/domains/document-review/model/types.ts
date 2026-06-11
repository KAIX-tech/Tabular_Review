import { z } from "zod";

export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // Base64 string for PDF/Images, or raw text for TXT
  mimeType: string;
}

// Real ingested document (backend `ingestion` context). Distinct from the
// client-side mock `DocumentFile`. Mirrors the API response (docs/domain-design.md §2.4).
export const documentStatusSchema = z.enum([
  "uploaded",
  "converting",
  "chunking",
  "ready",
  "failed",
]);

export const ingestedDocumentSchema = z.object({
  id: z.string(),
  documentDbId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative().nullish(),
  status: documentStatusSchema,
  error: z.string().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type IngestedDocument = z.infer<typeof ingestedDocumentSchema>;

/** Statuses where the ingestion pipeline is still running (poll for updates). */
export const PROCESSING_STATUSES: ReadonlySet<DocumentStatus> = new Set<DocumentStatus>([
  "uploaded",
  "converting",
  "chunking",
]);

export type ColumnType = "text" | "number" | "date" | "boolean" | "list";

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  prompt: string;
  status: "idle" | "extracting" | "completed" | "error";
  width?: number;
}

export interface ExtractionCell {
  value: string;
  /** Typed normalized value from the backend (number/boolean/list…). */
  valueJson?: unknown;
  confidence?: "High" | "Medium" | "Low";
  quote: string;
  page: number;
  reasoning: string;
  // UI State for review workflow
  status?: "verified" | "needs_review" | "edited";
  // Real extraction (Phase 3): backend cell id + how it was extracted.
  id?: string;
  extractionMethod?: "full_context" | "retrieval_fallback";
  extractionStatus?: "idle" | "queued" | "running" | "done" | "error";
}

export interface ExtractionResult {
  [docId: string]: {
    [colId: string]: ExtractionCell | null;
  };
}

// Column template library types
export interface ColumnTemplate {
  id: string;
  name: string;
  type: ColumnType;
  prompt: string;
  category?: string; // e.g., "Legal", "Financial", "Dates"
  createdAt: string;
}

export interface ColumnLibrary {
  version: 1;
  templates: ColumnTemplate[];
}

// --- Extraction cells / runs (backend `extraction` context) ---
// Domain source of truth for the API response shapes (validated in api/*.ts).
export const cellSourceSchema = z.object({
  chunkId: z.string().nullish(),
  quote: z.string(),
  page: z.number().int().nullish(),
  // Character offsets of the quote within the document markdown (highlighting).
  charStart: z.number().int().nullish(),
  charEnd: z.number().int().nullish(),
});

export const cellSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  columnId: z.string(),
  value: z.string().nullish(),
  valueJson: z.unknown().nullish(),
  confidence: z.enum(["high", "medium", "low"]).nullish(),
  reasoning: z.string().nullish(),
  extractionMethod: z.enum(["full_context", "retrieval_fallback"]).nullish(),
  extractionStatus: z.enum(["idle", "queued", "running", "done", "error"]),
  reviewStatus: z.enum(["unreviewed", "verified", "edited", "rejected"]),
  sources: z.array(cellSourceSchema),
});
export type CellDto = z.infer<typeof cellSchema>;

export const extractionRunSchema = z.object({
  id: z.string(),
  documentDbId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "canceled"]),
  total: z.number().int(),
  done: z.number().int(),
  failed: z.number().int(),
});
export type ExtractionRunDto = z.infer<typeof extractionRunSchema>;
