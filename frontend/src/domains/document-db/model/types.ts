import type { Column, DocumentFile, ExtractionResult } from "@/domains/document-review";

// A Document DB is one domain == one document type (flat IA), e.g. "계약서", "약관".
export interface DocumentDb {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  columnCount: number;
  updatedAt: string; // ISO timestamp
}

// Role decides which surfaces/actions are available (auth is out of scope; the
// role is assumed-known at entry and toggled via the Zustand UI store for now).
export type UserRole = "admin" | "user";

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
