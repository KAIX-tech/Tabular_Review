/**
 * Client-exposed environment configuration.
 *
 * Next.js only inlines `NEXT_PUBLIC_*` vars into the client bundle. Centralizing
 * the reads here keeps `process.env` access out of feature code.
 */
export const ENV = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  llmProxyUrl: process.env.NEXT_PUBLIC_LLM_PROXY_URL,
  llmModel: process.env.NEXT_PUBLIC_LLM_MODEL || "glm-5",
  llmTimeoutMs: Number(process.env.NEXT_PUBLIC_LLM_TIMEOUT_MS || 120000),
} as const;
