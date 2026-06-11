import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChatSession,
  deleteChatSession,
  getChatSessionDetail,
  listChatSessions,
  renameChatSession,
} from "./chat-sessions.api";

// Exported query keys for explicit cache contracts (no raw strings at call sites).
export const chatSessionKeys = {
  all: ["chat-sessions"] as const,
  detail: (id: string) => ["chat-sessions", id] as const,
};

export function useChatSessions() {
  return useQuery({
    queryKey: chatSessionKeys.all,
    queryFn: listChatSessions,
  });
}

export function useChatSessionDetail(id: string | null) {
  return useQuery({
    queryKey: chatSessionKeys.detail(id ?? ""),
    queryFn: () => getChatSessionDetail(id ?? ""),
    enabled: !!id,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scopeDocumentDbId: string | null = null) => createChatSession(scopeDocumentDbId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatSessionKeys.all }),
  });
}

export function useRenameChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameChatSession(id, title),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: chatSessionKeys.all });
      queryClient.invalidateQueries({ queryKey: chatSessionKeys.detail(id) });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatSessionKeys.all }),
  });
}
