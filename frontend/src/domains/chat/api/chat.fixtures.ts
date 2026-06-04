import type { ChatSource } from "../model/types";

export interface MockChatReply {
  text: string;
  sources: ChatSource[];
}

/**
 * Mock chat reply for a Document DB. Returns a scenario-style answer plus source
 * citations until the backend chat/RAG context exists (§9 of the screen plan).
 */
export function mockChatReply(dbName: string, message: string): MockChatReply {
  return {
    text:
      `“${message}”에 대한 분석 결과입니다.\n\n` +
      `${dbName} 내 문서를 비교한 결과, ACME_MSA 계약이 가장 유리한 조건을 가지고 있습니다. ` +
      `특히 MFN(최혜대우) 조항이 다른 계약보다 폭넓게 적용됩니다. (목업 응답)`,
    sources: [
      {
        documentName: "ACME_MSA.pdf",
        page: 12,
        quote:
          "...shall be governed by the laws of the State of New York, and the most favored nation treatment shall apply to all fees and commercial terms...",
      },
      {
        documentName: "Beta_NDA.pdf",
        page: 4,
        quote:
          "...the parties agree that no term more favorable shall be granted to any third party without offering the same to the Counterparty...",
      },
    ],
  };
}
