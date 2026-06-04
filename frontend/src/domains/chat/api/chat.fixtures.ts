import type { ChatSource } from "../model/types";

export interface MockChatReply {
  text: string;
  sources: ChatSource[];
}

/**
 * Mock chat reply spanning all Document DBs. Returns a scenario-style answer with
 * source citations drawn from multiple DBs until the backend chat/RAG context
 * exists (§9 of the screen plan).
 */
export function mockChatReply(message: string): MockChatReply {
  return {
    text:
      `“${message}”에 대한 분석 결과입니다.\n\n` +
      `전체 Document DB를 검색한 결과, 계약서 DB의 ACME_MSA 계약이 가장 폭넓은 MFN(최혜대우) 조항을 포함하고 있으며, ` +
      `약관 DB에서도 유사한 최혜대우 조항이 확인됩니다. (목업 응답)`,
    sources: [
      {
        documentDb: "계약서",
        documentName: "ACME_MSA.pdf",
        page: 12,
        quote:
          "...the most favored nation treatment shall apply to all fees and commercial terms granted to any other counterparty...",
      },
      {
        documentDb: "약관",
        documentName: "표준약관_v3.pdf",
        page: 7,
        quote:
          "...본 약관에서 정한 조건보다 유리한 조건을 제3자에게 제공하는 경우, 동일한 조건을 고객에게도 적용한다...",
      },
    ],
  };
}
