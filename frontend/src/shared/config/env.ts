/**
 * Client-exposed environment configuration.
 *
 * Next.js only inlines `NEXT_PUBLIC_*` vars into the client bundle. Centralizing
 * the reads here keeps `process.env` access out of feature code.
 */

// "false" => real API; anything else (incl. unset) => mocks. Per-domain flags
// fall back to the global one, so a backend can be switched on domain by domain
// as each context lands (e.g. document_db is real while chat/grid stay mocked).
const parseFlag = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === "" ? fallback : value !== "false";

const globalMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const ENV = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  llmProxyUrl: process.env.NEXT_PUBLIC_LLM_PROXY_URL,
  llmModel: process.env.NEXT_PUBLIC_LLM_MODEL || "glm-5",
  llmTimeoutMs: Number(process.env.NEXT_PUBLIC_LLM_TIMEOUT_MS || 120000),
  // Global mock-first default (kept for any non-domain reads).
  useMocks: globalMocks,
  // Per-domain mock toggles; each defaults to the global flag.
  mocks: {
    documentDb: parseFlag(process.env.NEXT_PUBLIC_USE_MOCKS_DOCUMENT_DB, globalMocks),
    chat: parseFlag(process.env.NEXT_PUBLIC_USE_MOCKS_CHAT, globalMocks),
  },
} as const;
