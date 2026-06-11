import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side chat UI state. Sessions/messages themselves live on the server
 * (PR-C — docs/phase-4-chat-plan.md D5); only the active selection persists
 * locally so a reload reopens the same conversation.
 *
 * "New Chat" clears the selection (activeId = null) and shows the empty
 * composer; the server session is created lazily on the first message, so
 * empty sessions never accumulate.
 */
interface ChatSessionsState {
  activeId: string | null;
  newSession: () => void;
  selectSession: (id: string) => void;
}

export const useChatSessionsStore = create<ChatSessionsState>()(
  persist(
    (set) => ({
      activeId: null,
      newSession: () => set({ activeId: null }),
      selectSession: (id) => set({ activeId: id }),
    }),
    {
      name: "tabular-review-chat-active-session",
      partialize: (state) => ({ activeId: state.activeId }),
    },
  ),
);
