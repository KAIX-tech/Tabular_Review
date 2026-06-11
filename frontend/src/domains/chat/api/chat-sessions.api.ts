import { getApiUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";
import axios from "axios";
import { z } from "zod";
import {
  type ChatSession,
  type ChatSessionDetail,
  chatSessionDetailSchema,
  chatSessionSchema,
} from "../model/types";
import {
  mockCreateSession,
  mockDeleteSession,
  mockGetSessionDetail,
  mockListSessions,
  mockRenameSession,
} from "./chat.fixtures";

const mockDelay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listChatSessions(): Promise<ChatSession[]> {
  if (ENV.mocks.chat) {
    await mockDelay();
    return mockListSessions();
  }
  const { data } = await axios.get(`${getApiUrl()}/chat/sessions`);
  return z.array(chatSessionSchema).parse(data);
}

export async function createChatSession(
  scopeDocumentDbId: string | null = null,
): Promise<ChatSession> {
  if (ENV.mocks.chat) {
    await mockDelay(100);
    return mockCreateSession(scopeDocumentDbId);
  }
  const { data } = await axios.post(`${getApiUrl()}/chat/sessions`, {
    scopeDocumentDbId,
  });
  return chatSessionSchema.parse(data);
}

export async function getChatSessionDetail(id: string): Promise<ChatSessionDetail | null> {
  if (ENV.mocks.chat) {
    await mockDelay(100);
    return mockGetSessionDetail(id);
  }
  try {
    const { data } = await axios.get(`${getApiUrl()}/chat/sessions/${id}`);
    return chatSessionDetailSchema.parse(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function renameChatSession(id: string, title: string): Promise<void> {
  if (ENV.mocks.chat) {
    await mockDelay(100);
    mockRenameSession(id, title);
    return;
  }
  await axios.patch(`${getApiUrl()}/chat/sessions/${id}`, { title });
}

export async function deleteChatSession(id: string): Promise<void> {
  if (ENV.mocks.chat) {
    await mockDelay(100);
    mockDeleteSession(id);
    return;
  }
  await axios.delete(`${getApiUrl()}/chat/sessions/${id}`);
}
