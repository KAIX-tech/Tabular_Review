import axios from "axios";
import { z } from "zod";
import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import { type DocumentDb, documentDbSchema } from "../model/types";
import { MOCK_DOCUMENT_DBS } from "./document-dbs.fixtures";

const mockDelay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock boundary: when ENV.useMocks is on, return fixtures (with simulated latency).
 * The real branch uses Axios and validates the response against the Zod schema, so
 * only the body changes once the backend `document-db` context lands.
 */
export async function getDocumentDbs(): Promise<DocumentDb[]> {
  if (ENV.useMocks) {
    await mockDelay();
    return MOCK_DOCUMENT_DBS;
  }

  const { data } = await axios.get(`${getApiUrl()}/document-dbs`);
  return z.array(documentDbSchema).parse(data);
}

export async function getDocumentDb(id: string): Promise<DocumentDb | null> {
  if (ENV.useMocks) {
    await mockDelay(150);
    return MOCK_DOCUMENT_DBS.find((db) => db.id === id) ?? null;
  }

  try {
    const { data } = await axios.get(`${getApiUrl()}/document-dbs/${id}`);
    return documentDbSchema.parse(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
