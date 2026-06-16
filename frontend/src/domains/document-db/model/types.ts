import type { Column, ColumnType, DocumentFile, ExtractionResult } from "@/domains/document-review";
import { z } from "zod";

// A Document DB is one domain == one document type (flat IA), e.g. "계약서", "약관".
export const documentDbSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Backend column is nullable; accept null/undefined (docs/domain-design.md §2.2).
  description: z.string().nullish(),
  documentCount: z.number().int().nonnegative(),
  columnCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(), // ISO 8601 (RFC3339 with Z)
});

export type DocumentDb = z.infer<typeof documentDbSchema>;

// Backend DocumentColumn response shape (validated in api/columns.api.ts).
export const columnResponseSchema = z.object({
  id: z.string(),
  documentDbId: z.string(),
  name: z.string(),
  dataType: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullish(),
  position: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ColumnResponse = z.infer<typeof columnResponseSchema>;

// Backend ColumnTemplate response shape (Column Library; validated in
// api/column-templates.api.ts). Global, firm-wide — see domain-design §2.3a.
export const columnTemplateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataType: z.string(),
  prompt: z.string(),
  category: z.string().nullish(),
  options: z.array(z.string()).nullish(),
  createdAt: z.string().datetime(),
});
export type ColumnTemplateResponse = z.infer<typeof columnTemplateResponseSchema>;

// UI shape (grid uses `type`, the ColumnType union). Mapped from the backend's
// 7-type `dataType` in api/column-templates.api.ts (multi_select → "list").
export interface ColumnTemplate {
  id: string;
  name: string;
  type: ColumnType;
  prompt: string;
  category?: string;
  options?: string[];
  createdAt: string;
}

export interface ColumnTemplateInput {
  name: string;
  type: ColumnType;
  prompt: string;
  category?: string;
  options?: string[];
}

// Column Library JSON export/import envelope (backward-compatible with the
// legacy localStorage format that used `type`).
export interface ColumnLibraryFile {
  version: 1;
  templates: ColumnTemplate[];
}

// Project export/import file format (not an API entity).
export interface SavedProject {
  version: 1;
  name: string;
  savedAt: string; // ISO timestamp
  columns: Column[];
  documents: DocumentFile[];
  results: ExtractionResult;
  selectedModel: string;
}
