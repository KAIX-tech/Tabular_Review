"use client";

import { MessageSquare, Pencil, Plus, Trash2 } from "@/shared/ui/icons";
import { useRouter } from "next/navigation";
import {
  useChatSessions,
  useDeleteChatSession,
  useRenameChatSession,
} from "../api/chat-sessions.hooks";
import { useChatSessionsStore } from "../model/chat-sessions.store";

/** Chat session nav under the "Chat" entry: New Chat + server-persisted history. */
export function ChatSessionList() {
  const router = useRouter();
  const { data: sessions = [] } = useChatSessions();
  const activeId = useChatSessionsStore((s) => s.activeId);
  const newSession = useChatSessionsStore((s) => s.newSession);
  const selectSession = useChatSessionsStore((s) => s.selectSession);
  const deleteSession = useDeleteChatSession();
  const renameSession = useRenameChatSession();

  const startNew = () => {
    newSession();
    router.push("/chat");
  };
  const open = (id: string) => {
    selectSession(id);
    router.push("/chat");
  };
  const rename = (id: string, current: string) => {
    const title = window.prompt("대화 이름", current)?.trim();
    if (title && title !== current) renameSession.mutate({ id, title });
  };
  const remove = (id: string) => {
    deleteSession.mutate(id);
    if (activeId === id) newSession();
  };

  return (
    <div className="pl-3.5 pr-1 py-0.5 space-y-0.5">
      <button
        type="button"
        onClick={startNew}
        className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-xs font-semibold text-primary hover:bg-primary-soft transition-colors duration-150"
      >
        <Plus className="w-3.5 h-3.5" />
        New Chat
      </button>

      {sessions.map((s) => {
        const active = s.id === activeId;
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => open(s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(s.id);
              }
            }}
            className={`group flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] cursor-pointer transition-colors duration-150 ${
              active
                ? "bg-primary-soft text-primary font-medium"
                : "text-ink-2 hover:bg-surface-muted hover:text-ink"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate flex-1">{s.title || "새 대화"}</span>
            <button
              type="button"
              title="이름 변경"
              onClick={(e) => {
                e.stopPropagation();
                rename(s.id, s.title);
              }}
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-ink-3 hover:text-ink shrink-0 transition-opacity"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="삭제"
              onClick={(e) => {
                e.stopPropagation();
                remove(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-ink-3 hover:text-rose-600 shrink-0 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
