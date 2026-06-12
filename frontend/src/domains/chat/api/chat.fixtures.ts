import { generateUuid } from "@/shared/lib/uuid";
import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  ChatSource,
  ChatStep,
} from "../model/types";

/**
 * Mock boundary for the chat domain (ENV.mocks.chat): an in-memory session
 * store plus a scripted agent reply, shaped exactly like the server wire
 * (sessions/messages/steps/sources). Lets the chat UI run without the backend.
 */

const now = () => new Date().toISOString();

const sessions = new Map<string, ChatSessionDetail>();

export function mockListSessions(): ChatSession[] {
  return [...sessions.values()]
    .map(({ messages: _messages, ...session }) => session)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function mockCreateSession(scopeDocumentDbId: string | null): ChatSession {
  const session: ChatSessionDetail = {
    id: generateUuid(),
    title: "새 대화",
    scopeDocumentDbId,
    createdAt: now(),
    updatedAt: now(),
    messages: [],
  };
  sessions.set(session.id, session);
  const { messages: _messages, ...wire } = session;
  return wire;
}

export function mockGetSessionDetail(id: string): ChatSessionDetail | null {
  const session = sessions.get(id);
  // Snapshot copy — the live store object must not alias the query cache
  // (a later mockAppendExchange push would leak into rendered data mid-stream).
  return session ? { ...session, messages: [...session.messages] } : null;
}

export function mockRenameSession(id: string, title: string): void {
  const session = sessions.get(id);
  if (session) {
    session.title = title;
    session.updatedAt = now();
  }
}

export function mockDeleteSession(id: string): void {
  sessions.delete(id);
}

export const MOCK_STEPS: ChatStep[] = [
  { step: 1, tool: "list_document_dbs", args: {}, summary: "DB 탐색" },
  { step: 2, tool: "list_columns", args: { documentDbId: "mock" }, summary: "컬럼 확인" },
  { step: 3, tool: "query_cells", args: { documentDbId: "mock" }, summary: "셀 조회" },
];

const MOCK_SOURCES: ChatSource[] = [
  {
    id: generateUuid(),
    kind: "chunk",
    chunkId: generateUuid(),
    cellId: null,
    quote:
      "...the most favored nation treatment shall apply to all fees and commercial terms granted to any other counterparty...",
    page: 12,
    rank: 1,
    documentName: "ACME_MSA.pdf",
  },
  {
    id: generateUuid(),
    kind: "cell",
    chunkId: null,
    cellId: generateUuid(),
    quote: "MFN조항 = 있음",
    page: null,
    rank: 2,
    documentName: "ACME_MSA.pdf",
    columnName: "MFN조항",
  },
];

/** Scripted answer body — also streamed as deltas before the store commit. */
export function mockAnswerContent(question: string): string {
  return [
    `“${question}”에 대한 분석 결과입니다.`,
    "계약서 DB 전체를 대상으로 MFN(최혜대우) 관련 컬럼과 원문 청크를 교차 조회했습니다. 추출 그리드에서 검증 완료된 셀 값을 우선 사용했고, 미검증 셀은 원문 인용으로 보강했습니다.",
    "## 비교 결과",
    "| 문서 | MFN 조항 | 적용 범위 | 비고 |\n|---|---|---|---|\n| ACME_MSA.pdf | **있음** | 수수료·상업 조건 전반 | 범위 최광 |\n| Beta_NDA.pdf | 없음 | - | 비밀유지 목적 한정 |\n| Gamma_SLA.pdf | 있음 | 서비스 요율 한정 | 소급 적용 없음 |\n| Delta_License.pdf | **있음** | 로열티 요율 | 분기별 정산 시 반영 |",
    "## 주요 차이점",
    "1. **적용 범위** — ACME_MSA는 “모든 상대방에게 부여된 수수료 및 상업 조건 전반”으로 가장 넓고, Gamma_SLA는 서비스 요율에 한정됩니다.\n2. **소급 적용** — ACME_MSA만 기지급분에 대한 소급 정산 의무를 명시합니다.\n3. **통지 의무** — Delta_License는 더 유리한 조건 부여 시 30일 내 서면 통지를 요구합니다.",
    "> “…the most favored nation treatment shall apply to all fees and commercial terms granted to any other counterparty…” — ACME_MSA 제12.3조",
    "## 결론",
    "계약서 DB의 **ACME_MSA** 계약이 적용 범위·소급 정산 측면에서 가장 폭넓은 MFN 조항을 포함하고 있습니다. Gamma_SLA와 Delta_License는 제한적 MFN으로, 실무상 분쟁 가능성은 통지 의무가 있는 Delta_License 쪽이 낮습니다.",
    "추가로 특정 계약의 조항 원문 전체나 다른 조항(해지, 손해배상 상한)과의 교차 비교가 필요하면 말씀해 주세요. (목업 응답)",
  ].join("\n\n");
}

/**
 * Append the user question + the scripted assistant answer to a mock session.
 * Call this AFTER streaming deltas (mirrors the server: the assistant message
 * is only persisted at stream end), or the finished answer leaks into the
 * session detail while the draft animation is still running.
 */
export function mockAppendExchange(sessionId: string, question: string): ChatMessage {
  const session = sessions.get(sessionId);
  const user: ChatMessage = {
    id: generateUuid(),
    role: "user",
    content: question,
    steps: null,
    sources: [],
    createdAt: now(),
  };
  const assistant: ChatMessage = {
    id: generateUuid(),
    role: "assistant",
    content: mockAnswerContent(question),
    steps: MOCK_STEPS,
    sources: MOCK_SOURCES,
    createdAt: now(),
  };
  if (session) {
    if (session.messages.length === 0) session.title = question.slice(0, 40);
    session.messages.push(user, assistant);
    session.updatedAt = now();
  }
  return assistant;
}
