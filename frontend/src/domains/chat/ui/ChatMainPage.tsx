"use client";

import { ArrowUp, ChevronRight, ExternalLink, Loader2, Paperclip, X } from "@/shared/ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  chatSessionKeys,
  useChatSessionDetail,
  useCreateChatSession,
} from "../api/chat-sessions.hooks";
import { sendChatMessageStream } from "../api/chat-stream.api";
import { useChatSessionsStore } from "../model/chat-sessions.store";
import type { ChatMessage, ChatSource, ChatStep } from "../model/types";

const SUGGESTED = [
  "MFN 조항이 가장 유리한 계약은?",
  "전체 DB에서 가장 흔한 조항은?",
  "최근 수정된 문서는?",
];

/** In-flight agent turn: the question, live steps, and a terminal error (D9). */
interface PendingTurn {
  question: string;
  steps: ChatStep[];
  error: string | null;
}

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

/** Live agent progress while streaming: one line per SSE `step` event. */
function StepTimeline({ steps }: { steps: ChatStep[] }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={s.step} className="flex items-center gap-2 text-xs text-ink-2">
            {isLast ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 grid place-items-center text-emerald-600 shrink-0">
                ✓
              </span>
            )}
            <span>{s.summary} 중…</span>
            <span className="text-ink-3 font-mono text-[10px]">{s.tool}</span>
          </div>
        );
      })}
      {steps.length === 0 && (
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
    </div>
  );
}

/** Collapsed tool-call trace of a finished assistant message (steps replay). */
function StepTrace({ steps }: { steps: ChatStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink-2 transition-colors"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        탐색 과정 {steps.length}단계
      </button>
      {open && (
        <ol className="mt-1.5 ml-4 space-y-1">
          {steps.map((s) => (
            <li key={s.step} className="text-xs text-ink-2">
              {s.step}. {s.summary}
              <span className="text-ink-3 font-mono text-[10px] ml-1.5">{s.tool}</span>
            </li>
          ))}
        </ol>
      )}
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
      {sources.map((src) => (
        <button
          key={src.id}
          type="button"
          data-cite
          onClick={() => onSelect(src)}
          title={
            src.kind === "chunk"
              ? `${src.documentName ?? "문서"}${src.page != null ? ` p.${src.page}` : ""}`
              : `${src.documentName ?? "문서"} · ${src.columnName ?? "추출값"}`
          }
          className={`tr-cite ${active?.id === src.id ? "bg-primary-soft text-primary" : ""}`}
        >
          {src.rank}
        </button>
      ))}
    </div>
  );
}

/** Global chat across all Document DBs — server sessions + agent SSE (PR-C). */
export function ChatMainPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeId = useChatSessionsStore((s) => s.activeId);
  const selectSession = useChatSessionsStore((s) => s.selectSession);
  const { data: detail } = useChatSessionDetail(activeId);
  const createSession = useCreateChatSession();

  const messages: ChatMessage[] = detail?.messages ?? [];

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingTurn | null>(null);
  // `source` holds the last shown citation (kept for smooth slide-out); `panelOpen` toggles it.
  const [source, setSource] = useState<ChatSource | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const streaming = pending !== null && pending.error === null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending?.steps.length, pending?.error]);

  // Close the source drawer on Escape or a click outside it (citation chips switch instead).
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (drawerRef.current?.contains(target)) return;
      if (target.closest?.("[data-cite]")) return;
      setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [panelOpen]);

  const openSource = (s: ChatSource) => {
    setSource(s);
    setPanelOpen(true);
  };

  // Jump targets (plan §4.1): chunk → document viewer, cell → the DB grid.
  const sourceLink = (s: ChatSource): string | null => {
    if (!s.documentDbId) return null;
    const base = `/document-dbs/${s.documentDbId}`;
    return s.kind === "chunk" && s.documentId ? `${base}?doc=${s.documentId}` : base;
  };

  const refresh = (sessionId: string) => {
    queryClient.invalidateQueries({ queryKey: chatSessionKeys.all });
    queryClient.invalidateQueries({ queryKey: chatSessionKeys.detail(sessionId) });
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || streaming) return;
    setInput("");
    setPending({ question: q, steps: [], error: null });

    let sessionId = activeId && detail ? activeId : null;
    if (!sessionId) {
      try {
        const session = await createSession.mutateAsync(null);
        sessionId = session.id;
        selectSession(session.id);
      } catch {
        setPending({ question: q, steps: [], error: "세션을 만들지 못했습니다." });
        return;
      }
    }
    const sid = sessionId;

    await sendChatMessageStream(sid, q, {
      onStep: (step) => setPending((p) => (p ? { ...p, steps: [...p.steps, step] } : p)),
      onAnswer: () => {},
      onDone: () => {
        refresh(sid);
        setPending(null);
      },
      onError: (message) => {
        // D9: the question is already persisted server-side — show it + retry.
        refresh(sid);
        setPending((p) =>
          p ? { ...p, error: message } : { question: q, steps: [], error: message },
        );
      },
    });
  };

  const retry = () => {
    if (!pending) return;
    const q = pending.question;
    setPending(null);
    void send(q);
  };

  const isEmpty = messages.length === 0 && pending === null;
  const activeCite = panelOpen ? source : null;
  // While streaming, the just-asked question isn't in the server detail yet —
  // render it locally; once refreshed it comes from the server (dedup below).
  const lastServerUserText = [...messages].reverse().find((m) => m.role === "user")?.content;
  const showPendingQuestion =
    pending !== null && (streaming || lastServerUserText !== pending.question);

  return (
    <div className="relative flex h-full overflow-hidden">
      <section className="flex-1 min-w-0 flex flex-col bg-canvas">
        <header className="h-16 px-6 flex flex-col justify-center border-b border-border bg-surface shrink-0">
          <h1 className="text-base font-semibold text-ink leading-tight">Chat</h1>
          <p className="text-xs text-ink-2">전체 Document DB에 대해 질문하세요</p>
        </header>

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-start px-6 pt-[24vh]">
            <div className="w-full max-w-2xl text-center">
              <h2 className="text-xl font-semibold text-ink tracking-tight">
                무엇을 도와드릴까요?
              </h2>
              <p className="text-sm text-ink-2 mt-2">
                에이전트가 Document DB 카탈로그를 탐색해 출처와 함께 답합니다.
              </p>
              <div className="mt-7">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={() => send(input)}
                  disabled={!input.trim()}
                />
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
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id}>
                      {m.steps && m.steps.length > 0 && <StepTrace steps={m.steps} />}
                      <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap break-words">
                        {m.content}
                      </p>
                      {m.sources.length > 0 && (
                        <SourceCitations
                          sources={m.sources}
                          active={activeCite}
                          onSelect={openSource}
                        />
                      )}
                    </div>
                  ),
                )}

                {showPendingQuestion && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2.5 text-sm leading-relaxed bg-primary-soft text-primary rounded-2xl rounded-tr-md">
                      {pending.question}
                    </div>
                  </div>
                )}
                {streaming && pending && <StepTimeline steps={pending.steps} />}
                {pending?.error && (
                  <div className="flex items-start gap-3">
                    <div className="px-4 py-3 text-sm leading-relaxed bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl rounded-tl-md">
                      {pending.error}
                      <button
                        type="button"
                        onClick={retry}
                        className="block mt-2 text-xs font-semibold text-rose-700 underline underline-offset-2"
                      >
                        다시 시도
                      </button>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 bg-canvas shrink-0">
              <div className="max-w-3xl mx-auto">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={() => send(input)}
                  disabled={!input.trim() || streaming}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Source citation drawer — slides in over the content (no reflow). Esc / outside click closes. */}
      <aside
        ref={drawerRef}
        className={`absolute top-0 right-0 h-full w-[360px] bg-surface border-l border-border shadow-popover flex flex-col transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!panelOpen}
      >
        {source && (
          <>
            <div className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="tr-badge tr-badge-neutral shrink-0">
                  {source.kind === "chunk" ? "원문" : "추출값"}
                </span>
                <span className="text-sm font-medium text-ink truncate">
                  {source.documentName ?? "문서"}
                </span>
                {source.kind === "chunk" && source.page != null && (
                  <span className="text-xs text-ink-3 shrink-0">p.{source.page}</span>
                )}
                {source.kind === "cell" && source.columnName && (
                  <span className="text-xs text-ink-3 shrink-0 truncate">{source.columnName}</span>
                )}
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} className="tr-icon-btn">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-sm leading-relaxed text-ink">
                <mark className="bg-yellow-200 text-ink px-0.5 rounded">{source.quote}</mark>
              </p>
            </div>
            {sourceLink(source) && (
              <div className="p-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => router.push(sourceLink(source) as string)}
                  className="tr-btn tr-btn-secondary w-full justify-center gap-1.5 h-9 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {source.kind === "chunk" ? "문서에서 보기" : "그리드에서 보기"}
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
