import type { DocumentDb } from "../model/types";

/**
 * Mock Document DB fixtures (one domain == one document type).
 * Used while the backend `document-db` context does not exist yet (§9 of the
 * screen plan). Shape matches the future API response exactly.
 */
export const MOCK_DOCUMENT_DBS: DocumentDb[] = [
  {
    id: "contracts",
    name: "계약서",
    description: "상용 계약서 검토 문서 모음",
    documentCount: 128,
    columnCount: 9,
    updatedAt: "2026-06-02T09:00:00.000Z",
  },
  {
    id: "terms",
    name: "약관",
    description: "이용약관·표준약관 분석",
    documentCount: 54,
    columnCount: 6,
    updatedAt: "2026-05-28T09:00:00.000Z",
  },
  {
    id: "litigation",
    name: "소송서면",
    description: "소장·답변서·준비서면",
    documentCount: 12,
    columnCount: 4,
    updatedAt: "2026-05-19T09:00:00.000Z",
  },
];
