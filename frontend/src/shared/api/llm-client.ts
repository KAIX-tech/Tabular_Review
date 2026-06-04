/**
 * Generic transport for the OpenAI-compatible vLLM proxy.
 *
 * This is provider-shaped plumbing only — no document/extraction/chat domain
 * concepts live here. Domain modules (document-review, chat) build their own
 * prompts and call `callVllmChat`.
 */
import { getLlmProxyUrl } from "@/shared/api/config";
import { ENV } from "@/shared/config/env";

export type VllmRole = "system" | "user" | "assistant";

export interface VllmMessage {
  role: VllmRole;
  content: string;
}

export interface VllmChatOptions {
  model?: string;
  messages: VllmMessage[];
  temperature?: number;
  responseFormat?: "text" | "json";
}

const llmProxyUrl = getLlmProxyUrl();
const defaultModel = ENV.llmModel;
const llmTimeoutMs = ENV.llmTimeoutMs;

export const MODEL_IDENTITY_INSTRUCTION =
  "If asked about your model, provider, or identity, say you are the on-prem LLM configured for this Tabular Review deployment. Do not claim to be Claude, Gemini, ChatGPT, or any other hosted model unless that identity is explicitly provided by the deployment configuration.";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 5,
  initialDelay = 1000,
): Promise<T> {
  let currentTry = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      currentTry++;

      const err = error as { status?: number; name?: string; message?: string };
      const status = err?.status;
      const isRetryable =
        status === 429 ||
        (typeof status === "number" && status >= 500) ||
        err?.name === "AbortError" ||
        err?.message?.includes("429") ||
        err?.message?.toLowerCase().includes("rate limit") ||
        err?.message?.toLowerCase().includes("quota");

      if (isRetryable && currentTry <= retries) {
        const delay = initialDelay * 2 ** (currentTry - 1) + Math.random() * 1000;
        console.warn(`LLM request failed. Retrying attempt ${currentTry} in ${delay.toFixed(0)}ms...`);
        await wait(delay);
        continue;
      }

      throw error;
    }
  }
}

export class VllmHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`vLLM request failed with status ${status}: ${body}`);
    this.name = "VllmHttpError";
    this.status = status;
    this.body = body;
  }
}

const resolveModel = (modelId?: string) => modelId || defaultModel;

export const normalizeOpenAiContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === "string") return part;
        const text = (part as { text?: unknown })?.text;
        if (typeof text === "string") return text;
        return "";
      })
      .join("");
  }
  return "";
};

export async function callVllmChat({
  model,
  messages,
  temperature = 0.1,
  responseFormat = "text",
}: VllmChatOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), llmTimeoutMs);

  const body: Record<string, unknown> = {
    model: resolveModel(model),
    messages,
    temperature,
    stream: false,
  };

  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(llmProxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new VllmHttpError(response.status, text);
    }

    const data = JSON.parse(text);
    const content = normalizeOpenAiContent(data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error("Empty response from model");
    }

    return content;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const isResponseFormatUnsupported = (error: unknown): boolean => {
  if (!(error instanceof VllmHttpError)) return false;
  if (error.status !== 400 && error.status !== 422) return false;
  return /response_format|json_object|extra_forbidden|unsupported/i.test(error.body);
};

const stripJsonCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
};

export const extractJsonObject = (text: string): string => {
  const stripped = stripJsonCodeFence(text);
  if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return stripped.slice(start, end + 1);
  }

  return stripped;
};
