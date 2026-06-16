// Public API for the document-review domain.
export type {
  Column,
  ColumnType,
  DocumentFile,
  ExtractionCell,
  ExtractionResult,
  IngestedDocument,
  DocumentStatus,
  // ColumnTemplate / ColumnLibrary moved to the document-db slice (server-backed).
} from "./model/types";
export { PROCESSING_STATUSES } from "./model/types";
export {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useDocumentContent,
  documentKeys,
} from "./api/documents.hooks";
export {
  useCells,
  useRun,
  useCreateRun,
  useReviewCell,
  useCellDetail,
  cellKeys,
} from "./api/extraction.cells.hooks";
export { CellDetailCard, type CellDetailData } from "./ui/CellDetailCard";

export { DataGrid } from "./ui/DataGrid";
export { DocumentViewer } from "./ui/DocumentViewer";
export { VerificationSidebar } from "./ui/VerificationSidebar";
export { AddColumnMenu } from "./ui/AddColumnMenu";
export { DocumentUpload } from "./ui/DocumentUpload";

export { extractColumnData, generatePromptHelper } from "./api/extraction.api";
export { processDocumentToMarkdown } from "./api/document-processor";

export { SAMPLE_COLUMNS, generateSampleFiles } from "./config/sample-data";
