import axios from "axios";
import { z } from "zod";
import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import { type IngestedDocument, ingestedDocumentSchema } from "../model/types";

/**
 * Real ingestion documents (backend `ingestion` context). Gated by the
 * per-domain `review` mock flag — in mock mode the grid uses the legacy
 * client-side `DocumentFile` flow instead, so these return empty/no-ops.
 */
export async function listDocuments(documentDbId: string): Promise<IngestedDocument[]> {
  if (ENV.mocks.review) return [];
  const { data } = await axios.get(`${getApiUrl()}/document-dbs/${documentDbId}/documents`);
  return z.array(ingestedDocumentSchema).parse(data);
}

export async function uploadDocument(
  documentDbId: string,
  file: File,
): Promise<IngestedDocument> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(
    `${getApiUrl()}/document-dbs/${documentDbId}/documents`,
    form,
  );
  return ingestedDocumentSchema.parse(data);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await axios.delete(`${getApiUrl()}/documents/${documentId}`);
}
