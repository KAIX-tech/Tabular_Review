import { ENV } from "@/shared/config/env";
import type { ChatMessage } from "../model/types";
import { type MockChatReply, mockChatReply } from "./chat.fixtures";

export type ChatReply = MockChatReply;

/**
 * Send a chat message scoped to a Document DB. Mock-first: returns a fixture
 * reply (with simulated latency) until the backend chat/RAG context exists.
 * Signature is stable so only the body changes once the backend lands.
 */
export async function sendChatMessage(
  dbName: string,
  message: string,
  _history: ChatMessage[],
): Promise<ChatReply> {
  if (ENV.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return mockChatReply(dbName, message);
  }
  throw new Error("Real Document DB chat is not implemented yet");
}
