export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // Base64 string for PDF/Images, or raw text for TXT
  mimeType: string;
}

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
