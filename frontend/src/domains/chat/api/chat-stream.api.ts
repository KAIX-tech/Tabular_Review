import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import {
  type ChatAnswerEvent,
  type ChatStep,
  chatAnswerEventSchema,
  chatStepSchema,
} from "../model/types";
import { MOCK_STEPS, mockAppendExchange } from "./chat.fixtures";

/**
 * Agent message streaming (docs/phase-4-chat-plan.md §4, D4/D9).
 *
 * POST + SSE means EventSource is out — we parse the stream via
 * fetch + ReadableStream. Browsers without a readable body fall back to the
 * server's non-streaming JSON response (final answer only, no step timeline).
 */

export interface ChatStreamHandlers {
  onStep: (step: ChatStep) => void;
  /** Live token chunk of the answer being generated (cosmetic; `answer` is
   * authoritative and replaces the accumulated draft). */
  onDelta: (text: string) => void;
  onAnswer: (answer: ChatAnswerEvent) => void;
  /** `error` SSE event, non-2xx response, or a stream cut before `done`. */
  onError: (message: string) => void;
  onDone: (messageId: string) => void;
}

export async function sendChatMessageStream(
  sessionId: string,
  content: string,
  handlers: ChatStreamHandlers,
): Promise<void> {
  if (ENV.mocks.chat) {
    for (const step of MOCK_STEPS) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      handlers.onStep(step);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    const assistant = mockAppendExchange(sessionId, content);
    // Simulate token streaming so the typing feel is visible offline too.
    for (const piece of assistant.content.match(/.{1,12}/gs) ?? []) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      handlers.onDelta(piece);
    }
    handlers.onAnswer({ content: assistant.content, sources: assistant.sources });
    handlers.onDone(assistant.id);
    return;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ content }),
    });
  } catch {
    handlers.onError("서버에 연결할 수 없습니다.");
    return;
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => body?.detail)
      .catch(() => null);
    handlers.onError(
      response.status === 409
        ? "이미 진행 중인 질문이 있습니다. 잠시 후 다시 시도해 주세요."
        : detail || `요청이 실패했습니다 (HTTP ${response.status})`,
    );
    return;
  }

  // Non-streaming fallback: the server answered with plain JSON (plan §4 2).
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    try {
      const body = await response.json();
      const message = body?.message;
      handlers.onAnswer(
        chatAnswerEventSchema.parse({ content: message.content, sources: message.sources }),
      );
      handlers.onDone(message.id);
    } catch {
      handlers.onError("응답을 해석하지 못했습니다.");
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const dispatch = (frame: string) => {
    const lines = frame.split("\n");
    const event = lines.find((l) => l.startsWith("event: "))?.slice(7);
    const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
    if (!event || data === undefined) return;
    const payload = JSON.parse(data);
    if (event === "step") {
      handlers.onStep(chatStepSchema.parse(payload));
    } else if (event === "delta") {
      handlers.onDelta(String(payload.text ?? ""));
    } else if (event === "answer") {
      handlers.onAnswer(chatAnswerEventSchema.parse(payload));
    } else if (event === "done") {
      finished = true;
      handlers.onDone(String(payload.messageId));
    } else if (event === "error") {
      finished = true;
      handlers.onError(String(payload.message ?? "에이전트 실행에 실패했습니다."));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch {
    if (!finished) handlers.onError("연결이 끊어졌습니다. 다시 시도해 주세요.");
    return;
  }
  // Stream closed without done/error (e.g. proxy cut) → surface as an error.
  if (!finished) handlers.onError("응답이 완료되지 않았습니다. 다시 시도해 주세요.");
}
