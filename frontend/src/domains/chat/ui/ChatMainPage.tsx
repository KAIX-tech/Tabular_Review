"use client";

import { CellDetailCard, DocumentViewer, useCellDetail } from "@/domains/document-review";
import { copyText } from "@/shared/lib/clipboard";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Paperclip,
  X,
} from "@/shared/ui/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, isValidElement, useContext, useEffect, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  chatSessionKeys,
  useChatSessionDetail,
  useCreateChatSession,
} from "../api/chat-sessions.hooks";
import { sendChatMessageStream } from "../api/chat-stream.api";
import { useChatSessionsStore } from "../model/chat-sessions.store";
import type { ChatMessage, ChatSource, ChatStep } from "../model/types";

const SUGGESTED = [
  "주주총회 특별결의가 필요한 거래는?",
  "Change of Control 조항이 있는 계약은?",
  "법률실사에서 우발부채 리스크가 지적된 문서는?",
];

/** In-flight agent turn: the question, live steps/draft, a terminal error (D9). */
interface PendingTurn {
  sessionId: string;
  question: string;
  steps: ChatStep[];
  /** Token-streamed answer text (SSE `delta`); replaced by the final answer. */
  draft: string;
  /** Authoritative answer text once the `answer` event lands. */
  finalContent: string | null;
  /** `done`/non-stream completion received — finish after the reveal drains. */
  done: boolean;
  /** How many blocks are currently revealed (paced cascade). */
  revealed: number;
  error: string | null;
}

// Hide citation markers while the draft streams (the final answer arrives with
// them already stripped); also trim a trailing half-typed marker.
const stripDraftMarkers = (draft: string): string =>
  draft
    .replace(/\[(chunk|cell):[0-9a-fA-F-]{36}\]/g, "")
    .replace(/\[(?:c(?:h(?:u(?:n(?:k)?)?)?|e(?:l(?:l)?)?)?)?:?[0-9a-fA-F-]*$/, "");

// Only COMPLETED markdown blocks (blank-line boundary) are eligible for
// display. Blocks must be whole because markdown reinterprets multi-line
// constructs (a table header line alone renders as a paragraph until its
// separator arrives).
const completedBlocks = (draft: string): string => {
  const lastBoundary = draft.lastIndexOf("\n\n");
  return lastBoundary >= 0 ? draft.slice(0, lastBoundary + 2) : "";
};

/** The full set of blocks available so far (final answer wins over the draft). */
const pendingBlocks = (p: PendingTurn): string[] => {
  const text = p.finalContent ?? stripDraftMarkers(completedBlocks(p.draft));
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
};

// Jitter-buffered reveal: the LLM produces blocks at an uneven rhythm (a
// block every few seconds on the on-prem GLM), so revealing on *arrival*
// shows chunk → dead air → chunk. Instead, hold a small prebuffer, measure
// the inter-block arrival gap (EMA), and pace reveals to spread the queue
// across the expected gap — playback runs slightly behind delivery but
// steady. Once `done`, drain fast (no point pacing what's fully here).
const REVEAL_PREBUFFER_BLOCKS = 2;
const REVEAL_MIN_MS = 60;
const REVEAL_MAX_MS = 1500;
const REVEAL_DRAIN_MS = 60;
const REVEAL_DRAIN_CATCHUP_MS = 30;
const REVEAL_CATCHUP_THRESHOLD = 3;
// Word wave stretches toward the arrival gap so typing fills the wait.
const WAVE_CAP_MIN_MS = 600;
const WAVE_CAP_MAX_MS = 2000;

// Chat-bubble markdown styling (the agent answers in markdown — headings,
// tables, lists). Sized for chat (text-sm) vs the document viewer's article.
const CHAT_MD_COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="text-sm font-semibold text-ink mt-3 mb-1">{children}</h2>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-ink mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-ink mt-2.5 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed text-ink my-1.5">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-1 text-sm text-ink">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-1 text-sm text-ink">{children}</ol>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-surface-muted text-[13px] font-mono">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border-strong pl-3 my-1.5 text-ink-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 bg-surface-muted text-left align-top">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

// Word-stagger: wrap each word of a freshly mounted block in a span with an
// incremental animation-delay so the block surfaces as a flowing wave (like
// modern LLM chats) instead of popping in as one unit. React keeps existing
// block DOM across streaming re-renders, so only new blocks wave in.
// The cap stretches toward the measured block-arrival gap (WaveCapContext) so
// slow generation reads as continuous typing instead of pop → wait → pop.
const WORD_STAGGER_MS = 24;
const WaveCapContext = createContext(WAVE_CAP_MIN_MS);

function Stagger({ children }: { children: React.ReactNode }) {
  const cap = useContext(WaveCapContext);
  let index = 0;
  const delay = () => `${Math.min(index++ * WORD_STAGGER_MS, cap)}ms`;
  const wrap = (node: React.ReactNode, key?: string | number): React.ReactNode => {
    if (typeof node === "string") {
      return node.split(/(\s+)/).map((part, k) =>
        part === "" || /^\s+$/.test(part) ? (
          part
        ) : (
          <span key={`${key}-${k}`} className="kalex-word" style={{ animationDelay: delay() }}>
            {part}
          </span>
        ),
      );
    }
    if (Array.isArray(node)) return node.map((child, k) => wrap(child, k));
    if (isValidElement(node)) {
      // Nested inline elements (strong/code/links) wave in as one unit.
      return (
        <span key={key} className="kalex-word" style={{ animationDelay: delay() }}>
          {node}
        </span>
      );
    }
    return node;
  };
  return <>{wrap(children)}</>;
}

// Streaming variant of the markdown map: text blocks stagger word-by-word;
// container constructs (table/blockquote) keep the block-level fade (CSS).
const STREAM_MD_COMPONENTS: Components = {
  ...CHAT_MD_COMPONENTS,
  h1: ({ children }) => (
    <h2 className="text-sm font-semibold text-ink mt-3 mb-1">
      <Stagger>{children}</Stagger>
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-ink mt-3 mb-1">
      <Stagger>{children}</Stagger>
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-ink mt-2.5 mb-1">
      <Stagger>{children}</Stagger>
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-ink my-1.5">
      <Stagger>{children}</Stagger>
    </p>
  ),
  li: ({ children }) => (
    <li>
      <Stagger>{children}</Stagger>
    </li>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 align-top">
      <Stagger>{children}</Stagger>
    </td>
  ),
};

function ChatMarkdown({
  content,
  animated = false,
  waveCapMs = WAVE_CAP_MIN_MS,
}: {
  content: string;
  animated?: boolean;
  /** Word-wave length for newly mounted blocks (jitter-buffer pacing hint). */
  waveCapMs?: number;
}) {
  // `animated` (streaming draft): word-stagger for text blocks + block fade
  // for container constructs (.chat-fade-blocks). Finished messages render
  // statically — blocks already in the DOM keep their nodes across streaming
  // re-renders, so only newly arrived content animates.
  return (
    <div className={`break-words ${animated ? "chat-fade-blocks" : ""}`}>
      <WaveCapContext.Provider value={waveCapMs}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={animated ? STREAM_MD_COMPONENTS : CHAT_MD_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </WaveCapContext.Provider>
    </div>
  );
}

// Auto-growing composer: 1 line tall, grows with content up to ~5 lines
// (max-h-40) then scrolls inside. Enter sends, Shift+Enter inserts a newline,
// and Enter during IME composition (한글 조합 중) never sends.
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
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  return (
    // The pill is the container; textarea and buttons are separate flex
    // columns inside it, so the textarea's scrollbar sits left of the buttons.
    <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl shadow-card pl-5 pr-2.5 py-2.5 transition focus-within:ring-2 focus-within:ring-primary/20">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="전체 Document DB에 대해 무엇이든 물어보세요…"
        className="flex-1 min-w-0 bg-transparent py-1.5 text-[15px] leading-6 text-ink placeholder:text-ink-3 focus:outline-none resize-none max-h-40 overflow-y-auto"
      />
      <div className="flex items-center gap-1 shrink-0">
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
          <div key={s.step} className="kalex-fade-in flex items-center gap-2 text-xs text-ink-2">
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
      {steps.length === 0 && <GeneratingDots />}
    </div>
  );
}

/** Symbolic "생성 중" indicator — three soft pulsing dots (shared visual
 *  language with the pre-step wait state; replaces the old caret bar). */
function GeneratingDots({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

/** Copy-to-clipboard with a brief ✓ confirmation (insecure-context fallback inside). */
function CopyButton({
  text,
  title = "복사",
  className = "",
}: {
  text: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }
      }}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md text-ink-3 hover:text-ink hover:bg-surface-muted transition-colors ${className}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/** User question bubble: copy action below, like the answer's (hover reveal).
 *  kalex-user-bubble scopes a solid-blue ::selection — the global soft-blue
 *  selection is invisible against the bubble's own soft-blue background. */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="group flex flex-col items-end">
      <div className="kalex-user-bubble max-w-[80%] px-4 py-2.5 text-sm leading-relaxed bg-primary-soft text-primary rounded-2xl rounded-tr-md select-text whitespace-pre-wrap break-words">
        {text}
      </div>
      <div className="mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <CopyButton text={text} title="질문 복사" />
      </div>
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

/** Cell-citation detail in the source drawer — the same card the admin
 *  verification sidebar uses (값/신뢰도/추론/출처), loaded read-only by id.
 *  `onOpenQuote` (set when the source can be located in a document) makes the
 *  AI-추론 citation chip swap the drawer to the document viewer. */
function ChatCellSourceDetail({
  source,
  onOpenQuote,
}: {
  source: ChatSource;
  onOpenQuote?: (quote: string) => void;
}) {
  const { data: cell, isLoading } = useCellDetail(source.cellId);
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-surface-muted animate-pulse" />
        <div className="h-6 w-40 rounded bg-surface-muted animate-pulse" />
        <div className="h-16 rounded bg-surface-muted animate-pulse" />
      </div>
    );
  }
  if (!cell) {
    return (
      <p className="text-sm leading-relaxed text-ink">
        <mark className="bg-primary/15 text-ink px-0.5 rounded">{source.quote}</mark>
      </p>
    );
  }
  const confidence =
    cell.confidence === "high"
      ? "High"
      : cell.confidence === "medium"
        ? "Medium"
        : cell.confidence === "low"
          ? "Low"
          : null;
  const cellSource = cell.sources[0];
  const quote = cellSource?.quote ?? source.quote;
  return (
    <CellDetailCard
      data={{
        columnName: source.columnName ?? "추출값",
        value: cell.value ?? "",
        valueJson: cell.valueJson,
        confidence,
        reasoning: cell.reasoning,
        quote,
        page: cellSource?.page ?? null,
      }}
      onOpenSource={onOpenQuote && quote ? () => onOpenQuote(quote) : undefined}
    />
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
  // Cell drawer's 원문 view: set when the AI-추론 citation chip is clicked —
  // swaps the drawer to the document viewer with this quote highlighted.
  const [cellQuote, setCellQuote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const streaming = pending !== null && pending.error === null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending?.steps.length, pending?.draft, pending?.error]);

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
    setCellQuote(null);
    setPanelOpen(true);
  };

  // Jump targets (plan §4.1): chunk → document viewer (cited passage
  // highlighted via the quote param), cell → the grid with that cell selected.
  const sourceLink = (s: ChatSource): string | null => {
    if (!s.documentDbId) return null;
    const base = `/document-dbs/${s.documentDbId}`;
    if (s.kind === "chunk" && s.documentId) {
      return `${base}?doc=${s.documentId}&quote=${encodeURIComponent(s.quote)}`;
    }
    if (s.kind === "cell" && s.documentId && s.columnId) {
      return `${base}?cell=${s.documentId}:${s.columnId}`;
    }
    return base;
  };

  const refresh = (sessionId: string) => {
    queryClient.invalidateQueries({ queryKey: chatSessionKeys.all });
    queryClient.invalidateQueries({ queryKey: chatSessionKeys.detail(sessionId) });
  };

  const emptyTurn = (sessionId: string, question: string): PendingTurn => ({
    sessionId,
    question,
    steps: [],
    draft: "",
    finalContent: null,
    done: false,
    revealed: 0,
    error: null,
  });

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || streaming) return;
    setInput("");
    setPending(emptyTurn("", q));

    let sessionId = activeId && detail ? activeId : null;
    if (!sessionId) {
      try {
        const session = await createSession.mutateAsync(null);
        sessionId = session.id;
        selectSession(session.id);
      } catch {
        setPending({ ...emptyTurn("", q), error: "세션을 만들지 못했습니다." });
        return;
      }
    }
    const sid = sessionId;
    setPending((p) => (p ? { ...p, sessionId: sid } : p));

    await sendChatMessageStream(sid, q, {
      // A step after streamed text means that text was a tool-calling round's
      // preamble, not the answer — drop the draft and keep the timeline.
      onStep: (step) =>
        setPending((p) =>
          p ? { ...p, steps: [...p.steps, step], draft: "", finalContent: null, revealed: 0 } : p,
        ),
      onDelta: (text) => setPending((p) => (p ? { ...p, draft: p.draft + text } : p)),
      onAnswer: (answer) => setPending((p) => (p ? { ...p, finalContent: answer.content } : p)),
      // Don't clear yet — the paced reveal drains the remaining blocks first;
      // the reveal effect below performs refresh + clear once caught up.
      onDone: () => setPending((p) => (p ? { ...p, done: true } : p)),
      onError: (message) => {
        // D9: the question is already persisted server-side — show it + retry.
        refresh(sid);
        setPending((p) =>
          p ? { ...p, error: message } : { ...emptyTurn(sid, q), error: message },
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
  // Jitter-buffered cascade: blocks become *eligible* as they complete; we
  // measure their arrival rhythm and play them back slightly behind delivery
  // at a steady pace (see constants above).
  const blocks = pending && !pending.error ? pendingBlocks(pending) : [];
  const visibleDraft = streaming && pending ? blocks.slice(0, pending.revealed).join("\n\n") : "";
  // Inter-block arrival gap (EMA). Refs, not state — updated per arrival, read
  // by the reveal timer; the timer firing re-renders anyway.
  const lastLenRef = useRef(0);
  const lastArrivalRef = useRef(0);
  const emaGapRef = useRef(0);
  const [waveCapMs, setWaveCapMs] = useState(WAVE_CAP_MIN_MS);
  // biome-ignore lint/correctness/useExhaustiveDependencies: arrival tracking is keyed to count only
  useEffect(() => {
    if (!pending || pending.error) {
      lastLenRef.current = 0;
      lastArrivalRef.current = 0;
      emaGapRef.current = 0;
      return;
    }
    if (blocks.length > lastLenRef.current) {
      const now = Date.now();
      if (lastArrivalRef.current > 0) {
        const gap = (now - lastArrivalRef.current) / (blocks.length - lastLenRef.current);
        emaGapRef.current = emaGapRef.current ? 0.7 * emaGapRef.current + 0.3 * gap : gap;
        // Stretch the word wave toward the arrival gap so typing fills the wait.
        setWaveCapMs(
          Math.round(Math.min(WAVE_CAP_MAX_MS, Math.max(WAVE_CAP_MIN_MS, emaGapRef.current * 0.8))),
        );
      }
      lastArrivalRef.current = now;
      lastLenRef.current = blocks.length;
    }
  }, [pending?.error, blocks.length, pending === null]);
  useEffect(() => {
    if (!pending || pending.error) return;
    if (pending.revealed >= blocks.length) {
      if (pending.done && pending.sessionId) {
        refresh(pending.sessionId);
        setPending(null);
      }
      return;
    }
    const behind = blocks.length - pending.revealed;
    let delay: number;
    if (pending.done) {
      // Everything is here — drain fast.
      delay = behind > REVEAL_CATCHUP_THRESHOLD ? REVEAL_DRAIN_CATCHUP_MS : REVEAL_DRAIN_MS;
    } else if (pending.revealed === 0 && blocks.length < REVEAL_PREBUFFER_BLOCKS) {
      // Prebuffer: hold playback until a small queue exists (or `done` lands) —
      // this lag is what the steady pace below spends.
      return;
    } else {
      // Spread the queue across the expected arrival gap; never slower than
      // one block per gap, never faster than the burst floor.
      const gap = emaGapRef.current || REVEAL_MIN_MS;
      delay = Math.round(Math.min(REVEAL_MAX_MS, Math.max(REVEAL_MIN_MS, gap / (behind + 1))));
    }
    const timer = window.setTimeout(
      () => setPending((p) => (p ? { ...p, revealed: p.revealed + 1 } : p)),
      delay,
    );
    return () => window.clearTimeout(timer);
    // Deliberately keyed to block COUNT (not the draft text) so per-token
    // re-renders don't reset the cadence timer.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  }, [pending?.revealed, pending?.done, pending?.error, blocks.length]);
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
                    <UserBubble key={m.id} text={m.content} />
                  ) : (
                    <div key={m.id} className="group select-text">
                      {m.steps && m.steps.length > 0 && <StepTrace steps={m.steps} />}
                      <ChatMarkdown content={m.content} />
                      <div className="mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <CopyButton text={m.content} title="답변 복사" />
                      </div>
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

                {showPendingQuestion && <UserBubble text={pending.question} />}
                {streaming && pending && visibleDraft === "" && (
                  <StepTimeline steps={pending.steps} />
                )}
                {streaming && pending && visibleDraft !== "" && (
                  <div>
                    <ChatMarkdown content={visibleDraft} animated waveCapMs={waveCapMs} />
                    <GeneratingDots className="mt-2" />
                  </div>
                )}
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

      {/* Source citation drawer — slides in over the content (no reflow). Esc /
          outside click closes. Chunk sources open the SAME document-viewer
          panel used everywhere else (markdown + quote highlight) — no separate
          quote-preview UI; cell sources show the shared cell detail card. */}
      <aside
        ref={drawerRef}
        className={`absolute top-0 right-0 h-full ${
          source?.documentId && (source.kind === "chunk" || cellQuote)
            ? "w-[600px] max-w-[90vw]"
            : "w-[360px]"
        } bg-surface border-l border-border shadow-popover flex flex-col transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!panelOpen}
      >
        {source &&
          (source.documentId && (source.kind === "chunk" || cellQuote) ? (
            <DocumentViewer
              documentId={source.documentId}
              name={source.documentName ?? "문서"}
              status="ready"
              onClose={() => {
                setPanelOpen(false);
                setCellQuote(null);
              }}
              highlightQuote={source.kind === "chunk" ? source.quote : (cellQuote ?? undefined)}
            />
          ) : (
            <>
              <div className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="tr-badge tr-badge-neutral shrink-0">
                    {source.kind === "chunk" ? "원문" : "추출값"}
                  </span>
                  <span className="text-sm font-medium text-ink truncate">
                    {source.documentName ?? "문서"}
                  </span>
                  {source.kind === "cell" && source.columnName && (
                    <span className="text-xs text-ink-3 shrink-0 truncate">
                      {source.columnName}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setPanelOpen(false)} className="tr-icon-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {source.kind === "cell" ? (
                  <ChatCellSourceDetail
                    source={source}
                    onOpenQuote={source.documentId ? setCellQuote : undefined}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-ink">
                    <mark className="bg-primary/15 text-ink px-0.5 rounded">{source.quote}</mark>
                  </p>
                )}
              </div>
              {source.kind === "cell" && sourceLink(source) && (
                <div className="p-4 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push(sourceLink(source) as string)}
                    className="tr-btn tr-btn-secondary w-full justify-center gap-1.5 h-9 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    그리드에서 보기
                  </button>
                </div>
              )}
            </>
          ))}
      </aside>
    </div>
  );
}
