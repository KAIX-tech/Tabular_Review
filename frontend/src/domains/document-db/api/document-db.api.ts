import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import type { DocumentDb } from "../model/types";
import { MOCK_DOCUMENT_DBS } from "./document-dbs.fixtures";

const mockDelay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock boundary: when ENV.useMocks is on, return fixtures (with simulated
 * latency so loading states are exercised). The real branch keeps the same
 * signature so only the body changes once the backend `document-db` context lands.
 */
export async function getDocumentDbs(): Promise<DocumentDb[]> {
  if (ENV.useMocks) {
    await mockDelay();
    return MOCK_DOCUMENT_DBS;
  }

  const response = await fetch(`${getApiUrl()}/document-dbs`);
  if (!response.ok) {
    throw new Error(`Failed to load Document DBs: ${response.status}`);
  }
  return response.json();
}

export async function getDocumentDb(id: string): Promise<DocumentDb | null> {
  if (ENV.useMocks) {
    await mockDelay(150);
    return MOCK_DOCUMENT_DBS.find((w) => w.id === id) ?? null;
  }

  const response = await fetch(`${getApiUrl()}/document-dbs/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load Document DB ${id}: ${response.status}`);
  }
  return response.json();
}
