import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, ChatSession } from "./types";

/**
 * Chat sessions, persisted to localStorage.
 *
 * "New Chat" clears the active session (activeId = null) and shows the empty
 * composer; a session is created lazily on the first message, so empty sessions
 * never accumulate. The active session's messages drive the chat view.
 */
interface ChatSessionsState {
  sessions: ChatSession[];
  activeId: string | null;
  newSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  appendMessage: (message: ChatMessage) => void;
}

export const useChatSessionsStore = create<ChatSessionsState>()(
  persist(
    (set) => ({
      sessions: [],
      activeId: null,
      newSession: () => set({ activeId: null }),
      selectSession: (id) => set({ activeId: id }),
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),
      appendMessage: (message) =>
        set((state) => {
          let sessions = state.sessions;
          let activeId = state.activeId;

          if (!sessions.some((s) => s.id === activeId)) {
            const created: ChatSession = {
              id: crypto.randomUUID(),
              title: "새 대화",
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            sessions = [created, ...sessions];
            activeId = created.id;
          }

          sessions = sessions.map((s) => {
            if (s.id !== activeId) return s;
            const title =
              s.messages.length === 0 && message.role === "user" ? message.text.slice(0, 40) : s.title;
            return { ...s, title, messages: [...s.messages, message], updatedAt: Date.now() };
          });

          return { sessions, activeId };
        }),
    }),
    {
      name: "tabular-review-chat-sessions",
      partialize: (state) => ({ sessions: state.sessions, activeId: state.activeId }),
    },
  ),
);
