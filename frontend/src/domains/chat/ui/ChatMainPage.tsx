"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, X } from "@/shared/ui/icons";
import { sendChatMessage } from "../api/document-db-chat.api";
import { useChatSessionsStore } from "../model/chat-sessions.store";
import type { ChatMessage, ChatSource } from "../model/types";

const SUGGESTED = [
  "MFN 조항이 가장 유리한 계약은?",
  "전체 DB에서 가장 흔한 조항은?",
  "최근 수정된 문서는?",
];

function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex items-center">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder="전체 Document DB에 대해 무엇이든 물어보세요…"
        className="w-full h-14 bg-surface border border-border rounded-2xl pl-5 pr-[5.5rem] text-[15px] text-ink placeholder:text-ink-3 shadow-card transition focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="absolute right-2.5 flex items-center gap-1">
        <button type="button" title="첨부" className="tr-icon-btn h-9 w-9">
          <Paperclip className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          className="tr-btn tr-btn-primary h-9 w-9 !p-0 rounded-full"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function SourceCitations({
  sources,
  active,
  onSelect,
}: {
  sources: ChatSource[];
  active: ChatSource | null;
  onSelect: (s: ChatSource) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-ink-3 mr-0.5">출처</span>
      {sources.map((src, i) => (
        <button
          key={`${src.documentName}-${i}`}
          type="button"
          onClick={() => onSelect(src)}
          title={`${src.documentDb} · ${src.documentName} p.${src.page}`}
          className={`tr-cite ${active === src ? "bg-primary-soft text-primary" : ""}`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

/** Global chat across all Document DBs, with sessions and source citations. */
export function ChatMainPage() {
  const sessions = useChatSessionsStore((s) => s.sessions);
  const activeId = useChatSessionsStore((s) => s.activeId);
  const appendMessage = useChatSessionsStore((s) => s.appendMessage);
  const messages: ChatMessage[] = sessions.find((s) => s.id === activeId)?.messages ?? [];

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

  const isEmpty = messages.length === 0 && !isTyping;

  return (
    <div className="flex h-full">
      <section className="flex-1 min-w-0 flex flex-col bg-canvas">
        <header className="h-16 px-6 flex flex-col justify-center border-b border-border bg-surface shrink-0">
          <h1 className="text-base font-semibold text-ink leading-tight">Chat</h1>
          <p className="text-xs text-ink-2">전체 Document DB에 대해 질문하세요</p>
        </header>

        {isEmpty ? (
          /* New chat: centered, emphasized composer */
          <div className="flex-1 flex flex-col items-center justify-start px-6 pt-[16vh]">
            <div className="w-full max-w-2xl text-center">
              <h2 className="text-xl font-semibold text-ink tracking-tight">무엇을 도와드릴까요?</h2>
              <p className="text-sm text-ink-2 mt-2">
                전체 Document DB를 검색해 답하고, 출처를 함께 보여드립니다.
              </p>
              <div className="mt-7">
                <Composer value={input} onChange={setInput} onSend={() => send(input)} disabled={!input.trim()} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="px-3.5 py-2 text-xs bg-surface border border-border rounded-full text-ink-2 transition-colors duration-150 hover:border-border-strong hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed bg-primary-soft text-primary rounded-2xl rounded-tr-md">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id}>
                      <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap break-words">{m.text}</p>
                      {m.sources && m.sources.length > 0 && (
                        <SourceCitations sources={m.sources} active={activeSource} onSelect={setActiveSource} />
                      )}
                    </div>
                  ),
                )}

                {isTyping && (
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 bg-canvas shrink-0">
              <div className="max-w-3xl mx-auto">
                <Composer value={input} onChange={setInput} onSend={() => send(input)} disabled={!input.trim()} />
              </div>
            </div>
          </>
        )}
      </section>

      {activeSource && (
        <aside className="w-[360px] shrink-0 border-l border-border bg-surface flex flex-col">
          <div className="h-16 px-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="tr-badge tr-badge-neutral shrink-0">{activeSource.documentDb}</span>
              <span className="text-sm font-medium text-ink truncate">{activeSource.documentName}</span>
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
