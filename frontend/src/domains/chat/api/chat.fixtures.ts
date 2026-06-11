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
    id: crypto.randomUUID(),
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
  return sessions.get(id) ?? null;
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
    id: crypto.randomUUID(),
    kind: "chunk",
    chunkId: crypto.randomUUID(),
    cellId: null,
    quote:
      "...the most favored nation treatment shall apply to all fees and commercial terms granted to any other counterparty...",
    page: 12,
    rank: 1,
    documentName: "ACME_MSA.pdf",
  },
  {
    id: crypto.randomUUID(),
    kind: "cell",
    chunkId: null,
    cellId: crypto.randomUUID(),
    quote: "MFN조항 = 있음",
    page: null,
    rank: 2,
    documentName: "ACME_MSA.pdf",
    columnName: "MFN조항",
  },
];

/** Append the user question + a scripted assistant answer to a mock session. */
export function mockAppendExchange(sessionId: string, question: string): ChatMessage {
  const session = sessions.get(sessionId);
  const user: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: question,
    steps: null,
    sources: [],
    createdAt: now(),
  };
  const assistant: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: `“${question}”에 대한 분석 결과입니다.\n\n계약서 DB의 ACME_MSA 계약이 가장 폭넓은 MFN(최혜대우) 조항을 포함하고 있습니다. (목업 응답)`,
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
