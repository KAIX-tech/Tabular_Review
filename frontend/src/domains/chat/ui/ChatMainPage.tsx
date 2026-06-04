"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileText, Send, User, X } from "@/shared/ui/icons";
import { sendChatMessage } from "../api/document-db-chat.api";
import { useChatSessionsStore } from "../model/chat-sessions.store";
import type { ChatSource } from "../model/types";

const SUGGESTED = [
  "MFN 조항이 가장 유리한 계약은?",
  "전체 DB에서 가장 흔한 조항은?",
  "최근 수정된 문서는?",
];

/** Global chat across all Document DBs, with sessions and source citations. */
export function ChatMainPage() {
  const sessions = useChatSessionsStore((s) => s.sessions);
  const activeId = useChatSessionsStore((s) => s.activeId);
  const appendMessage = useChatSessionsStore((s) => s.appendMessage);
  const messages = sessions.find((s) => s.id === activeId)?.messages ?? [];

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeSource, setActiveSource] = useState<ChatSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || isTyping) return;
    appendMessage({ id: crypto.randomUUID(), role: "user", text: q, timestamp: Date.now() });
    setInput("");
    setIsTyping(true);
    try {
      const reply = await sendChatMessage(q, messages);
      appendMessage({
        id: crypto.randomUUID(),
        role: "model",
        text: reply.text,
        timestamp: Date.now(),
        sources: reply.sources,
      });
    } catch {
      appendMessage({
        id: crypto.randomUUID(),
        role: "model",
        text: "오류가 발생했습니다. 다시 시도해 주세요.",
        timestamp: Date.now(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full">
      <section className="flex-1 min-w-0 flex flex-col bg-canvas">
        <header className="h-16 px-6 flex items-center gap-3 border-b border-border bg-surface shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-primary-soft text-primary">
            <Bot className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-ink leading-tight">Chat</h1>
            <p className="text-xs text-ink-2">전체 Document DB에 대해 질문하세요</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-surface border border-border text-primary shadow-soft">
                <Bot className="w-7 h-7" />
              </span>
              <p className="text-ink-2 text-sm">전체 Document DB에 대해 무엇이든 물어보세요.</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3.5 py-2 text-xs bg-surface border border-border rounded-full text-ink-2 transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[78%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <span
                  className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 text-white ${
                    m.role === "user" ? "bg-primary" : "bg-ink"
                  }`}
                >
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <div
                    className={`px-4 py-3 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-2xl rounded-tr-sm"
                        : "bg-surface border border-border text-ink rounded-2xl rounded-tl-sm shadow-soft"
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.sources.map((src, i) => (
                        <button
                          key={`${m.id}-${src.documentName}-${i}`}
                          type="button"
                          onClick={() => setActiveSource(src)}
                          className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-[11px] rounded-md border transition-colors duration-150 ${
                            activeSource === src
                              ? "bg-primary-soft border-primary/30 text-primary"
                              : "bg-surface border-border text-ink-2 hover:border-primary/40 hover:text-ink"
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="font-medium">{src.documentDb}</span>
                          <span className="text-ink-3">·</span>
                          {src.documentName} p.{src.page}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-ink text-white shrink-0">
                  <Bot className="w-4 h-4" />
                </span>
                <div className="bg-surface border border-border px-4 py-3.5 rounded-2xl rounded-tl-sm shadow-soft flex items-center gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-6 py-4 bg-surface border-t border-border shrink-0">
          <div className="relative flex items-center max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="전체 Document DB에 대해 무엇이든 물어보세요…"
              className="tr-input pr-12"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || isTyping}
              className="tr-btn tr-btn-primary absolute right-1.5 h-9 w-9 !p-0 rounded-full"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {activeSource && (
        <aside className="w-[360px] shrink-0 border-l border-border bg-surface flex flex-col">
          <div className="h-16 px-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-ink-3 shrink-0" />
              <span className="text-sm font-semibold text-ink truncate">
                {activeSource.documentDb} · {activeSource.documentName}
              </span>
              <span className="text-xs text-ink-3 shrink-0">p.{activeSource.page}</span>
            </div>
            <button type="button" onClick={() => setActiveSource(null)} className="tr-icon-btn">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-sm leading-relaxed text-ink">
              <mark className="bg-yellow-200 text-ink px-0.5 rounded">{activeSource.quote}</mark>
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
