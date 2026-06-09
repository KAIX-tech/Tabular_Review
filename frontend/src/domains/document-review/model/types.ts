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
  confidence: "High" | "Medium" | "Low";
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
