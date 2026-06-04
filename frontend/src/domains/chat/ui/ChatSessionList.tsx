"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Trash2 } from "@/shared/ui/icons";
import { useChatSessionsStore } from "../model/chat-sessions.store";

/** Chat session nav under the "Chat" entry: New Chat + persisted session history. */
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
    <div className="pl-3.5 pr-1 py-0.5 space-y-0.5">
      <button
        type="button"
        onClick={startNew}
        className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-xs font-semibold text-primary hover:bg-primary-soft transition-colors duration-150"
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
            className={`group flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] cursor-pointer transition-colors duration-150 ${
              active ? "bg-primary-soft text-primary font-medium" : "text-ink-2 hover:bg-surface-muted hover:text-ink"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate flex-1">{s.title || "새 대화"}</span>
            <button
              type="button"
              title="삭제"
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-rose-600 shrink-0 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
