import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import { generateUuid } from "@/shared/lib/uuid";
import axios from "axios";
import { z } from "zod";
import { type DocumentDb, documentDbSchema } from "../model/types";
import { MOCK_DOCUMENT_DBS } from "./document-dbs.fixtures";

const mockDelay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock boundary: when ENV.mocks.documentDb is on, return fixtures (with simulated latency).
 * The real branch uses Axios and validates the response against the Zod schema, so
 * only the body changes once the backend `document-db` context lands.
 */
export async function getDocumentDbs(): Promise<DocumentDb[]> {
  if (ENV.mocks.documentDb) {
    await mockDelay();
    return MOCK_DOCUMENT_DBS;
  }

  const { data } = await axios.get(`${getApiUrl()}/document-dbs`);
  return z.array(documentDbSchema).parse(data);
}

export async function getDocumentDb(id: string): Promise<DocumentDb | null> {
  if (ENV.mocks.documentDb) {
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

export interface CreateDocumentDbInput {
  name: string;
  description?: string;
}

export async function createDocumentDb(input: CreateDocumentDbInput): Promise<DocumentDb> {
  if (ENV.mocks.documentDb) {
    await mockDelay();
    const db: DocumentDb = {
      id: generateUuid(),
      name: input.name,
      description: input.description,
      documentCount: 0,
      columnCount: 0,
      updatedAt: new Date().toISOString(),
    };
    MOCK_DOCUMENT_DBS.unshift(db); // mutate the in-memory fixture so the mock list reflects it
    return db;
  }

  const { data } = await axios.post(`${getApiUrl()}/document-dbs`, input);
  return documentDbSchema.parse(data);
}

export async function deleteDocumentDb(id: string): Promise<void> {
  if (ENV.mocks.documentDb) {
    await mockDelay(150);
    const index = MOCK_DOCUMENT_DBS.findIndex((db) => db.id === id);
    if (index >= 0) MOCK_DOCUMENT_DBS.splice(index, 1);
    return;
  }

  await axios.delete(`${getApiUrl()}/document-dbs/${id}`);
}
