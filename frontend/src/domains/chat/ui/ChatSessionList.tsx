"use client";

import { MessageSquare, Plus, Trash2 } from "@/shared/ui/icons";
import { useChatSessionsStore } from "../model/chat-sessions.store";

/** Left sub-panel of the chat surface: New Chat + session history list. */
export function ChatSessionList() {
  const sessions = useChatSessionsStore((s) => s.sessions);
  const activeId = useChatSessionsStore((s) => s.activeId);
  const newSession = useChatSessionsStore((s) => s.newSession);
  const selectSession = useChatSessionsStore((s) => s.selectSession);
  const deleteSession = useChatSessionsStore((s) => s.deleteSession);

  return (
    <div className="w-64 shrink-0 h-full border-r border-slate-200 bg-white flex flex-col">
      <div className="p-3 border-b border-slate-100">
        <button
          type="button"
          onClick={newSession}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          대화 기록
        </p>
        {sessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-slate-400">아직 대화가 없습니다.</p>
        )}
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => selectSession(s.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectSession(s.id)}
              className={`group flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
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
    </div>
  );
}
