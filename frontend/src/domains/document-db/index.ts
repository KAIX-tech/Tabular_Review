// Public API for the document-db domain (a "Document DB" = one domain == one document type).
export type { SavedProject, DocumentDb } from "./model/types";
export { saveProject, loadProject } from "./lib/project-storage";
export { DocumentDbReviewPage } from "./ui/DocumentDbReviewPage";
export { DocumentDbRail } from "./ui/DocumentDbRail";
export { DocumentDbListPage } from "./ui/DocumentDbListPage";
export {
  useDocumentDbs,
  useDocumentDb,
  useCreateDocumentDb,
  useDeleteDocumentDb,
  documentDbKeys,
} from "./api/document-db.hooks";
export type { ColumnInput } from "./api/columns.api";
export {
  useColumns,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  columnKeys,
} from "./api/columns.hooks";
