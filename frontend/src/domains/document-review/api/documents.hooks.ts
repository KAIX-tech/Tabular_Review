import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PROCESSING_STATUSES } from "../model/types";
import { deleteDocument, listDocuments, uploadDocument } from "./documents.api";

export const documentKeys = {
  byDb: (dbId: string) => ["documents", dbId] as const,
};

// document-db's list query key (kept as a literal to avoid a document-db <-> the
// review domain import cycle); see documentDbKeys.all in document-db.
const DOCUMENT_DBS_KEY = ["document-dbs"] as const;

export function useDocuments(documentDbId: string) {
  return useQuery({
    queryKey: documentKeys.byDb(documentDbId),
    queryFn: () => listDocuments(documentDbId),
    enabled: !!documentDbId,
    // Poll while any document is still being processed by the pipeline.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((d) => PROCESSING_STATUSES.has(d.status)) ? 2000 : false,
  });
}

export function useUploadDocument(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(documentDbId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.byDb(documentDbId) });
      // Bump the DocumentDb list so its documentCount reflects the new upload.
      queryClient.invalidateQueries({ queryKey: DOCUMENT_DBS_KEY });
    },
  });
}

export function useDeleteDocument(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.byDb(documentDbId) });
      queryClient.invalidateQueries({ queryKey: DOCUMENT_DBS_KEY });
    },
  });
}
