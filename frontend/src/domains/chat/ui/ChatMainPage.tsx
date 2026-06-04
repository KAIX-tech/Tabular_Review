"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileText, Send, User, X } from "@/shared/ui/icons";
import { sendChatMessage } from "../api/document-db-chat.api";
import type { ChatMessage, ChatSource } from "../model/types";

const SUGGESTED = [
  "MFN 조항이 가장 유리한 계약은?",
  "전체 DB에서 가장 흔한 조항은?",
  "최근 수정된 문서는?",
];

/** Global chat surface across all Document DBs, with source citations. */
export function ChatMainPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeSource, setActiveSource] = useState<ChatSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || isTyping) return;
    const userMsg: ChatMessage = { id: `${Date.now()}`, role: "user", text: q, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const reply = await sendChatMessage(q, messages);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now() + 1}`, role: "model", text: reply.text, timestamp: Date.now(), sources: reply.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now() + 1}`, role: "model", text: "오류가 발생했습니다. 다시 시도해 주세요.", timestamp: Date.now() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full">
      <section className="flex-1 min-w-0 flex flex-col bg-slate-50">
        <header className="h-16 px-6 flex items-center gap-2 border-b border-slate-200 bg-white shrink-0">
          <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-600">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 leading-tight">Chat</h1>
            <p className="text-xs text-slate-500">전체 Document DB에 대해 질문하세요</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="p-3 bg-white border border-slate-200 rounded-full text-indigo-500">
                <Bot className="w-8 h-8" />
              </div>
              <p className="text-slate-500 text-sm">전체 Document DB에 대해 무엇이든 물어보세요.</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-2 max-w-[80%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${
                    m.role === "user" ? "bg-indigo-600" : "bg-emerald-600"
                  }`}
                >
                  {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div
                    className={`p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap break-words leading-relaxed ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
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
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
                            activeSource === src
                              ? "bg-amber-100 border-amber-300 text-amber-800"
                              : "bg-white border-slate-200 text-slate-600 hover:border-amber-300"
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          {src.documentDb} · {src.documentName} p.{src.page}
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
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="relative flex items-center max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="전체 Document DB에 대해 무엇이든 물어보세요…"
              className="w-full bg-slate-100 border-none rounded-full py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {activeSource && (
        <aside className="w-[360px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">
                {activeSource.documentDb} · {activeSource.documentName}
              </span>
              <span className="text-xs text-slate-400 shrink-0">p.{activeSource.page}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSource(null)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm leading-relaxed text-slate-800">
              <mark className="bg-yellow-200 text-slate-900 px-0.5 rounded">{activeSource.quote}</mark>
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
