import type { Column, DocumentFile, ExtractionResult } from "@/domains/document-review";

// Project persistence types
export interface SavedProject {
  version: 1;
  name: string;
  savedAt: string; // ISO timestamp
  columns: Column[];
  documents: DocumentFile[];
  results: ExtractionResult;
  selectedModel: string;
}
