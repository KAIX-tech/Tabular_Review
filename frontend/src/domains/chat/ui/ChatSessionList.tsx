"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Trash2 } from "@/shared/ui/icons";
import { useChatSessionsStore } from "../model/chat-sessions.store";

/**
 * Chat session nav, embedded under the "Chat" entry in the main sidebar:
 * a New Chat button + the persisted session history. Navigates to /chat on use.
 */
export function ChatSessionList() {
  const router = useRouter();
  const sessions = useChatSessionsStore((s) => s.sessions);
  const activeId = useChatSessionsStore((s) => s.activeId);
  const newSession = useChatSessionsStore((s) => s.newSession);
  const selectSession = useChatSessionsStore((s) => s.selectSession);
  const deleteSession = useChatSessionsStore((s) => s.deleteSession);

  const startNew = () => {
    newSession();
    router.push("/chat");
  };
  const open = (id: string) => {
    selectSession(id);
    router.push("/chat");
  };

  return (
    <div className="pl-3 pr-1 pb-1 space-y-0.5">
      <button
        type="button"
        onClick={startNew}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />New Chat
      </button>

      {sessions.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => open(s.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(s.id)}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors ${
              active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${active ? "text-indigo-500" : "text-slate-300"}`} />
            <span className="truncate flex-1">{s.title || "새 대화"}</span>
            <button
              type="button"
              title="삭제"
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 shrink-0 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
