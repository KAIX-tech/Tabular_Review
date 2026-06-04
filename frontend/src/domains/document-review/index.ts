// Public API for the document-review domain.
export type {
  Column,
  ColumnType,
  DocumentFile,
  ExtractionCell,
  ExtractionResult,
  ColumnTemplate,
  // NOTE: the `ColumnLibrary` *type* is intentionally not re-exported here to
  // avoid colliding with the `ColumnLibrary` UI component below. It is an
  // internal model used by column-library.ts and the modal.
} from "./model/types";

export { DataGrid } from "./ui/DataGrid";
export { VerificationSidebar } from "./ui/VerificationSidebar";
export { AddColumnMenu } from "./ui/AddColumnMenu";
export { ColumnLibrary } from "./ui/ColumnLibrary";
export { DocumentUpload } from "./ui/DocumentUpload";

export { extractColumnData, generatePromptHelper } from "./api/extraction.api";
export { processDocumentToMarkdown } from "./api/document-processor";

export { SAMPLE_COLUMNS, generateSampleFiles } from "./config/sample-data";
