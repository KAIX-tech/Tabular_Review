import { ENV } from "@/shared/config/env";

// A scheme-less base URL (e.g. "10.10.190.2:18003" when BACKEND_HOST omits
// http://) would be treated as a RELATIVE path by axios/fetch and appended to
// the page origin — normalize to an absolute http URL, mirroring the backend's
// FRONTEND_HOST handling.
const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.replace(/\/$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
};

export const getApiUrl = (): string => {
  if (ENV.apiUrl) {
    return normalizeBaseUrl(ENV.apiUrl);
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:18001`;
  }

  return "http://localhost:8000";
};

export const getLlmProxyUrl = (): string => {
  if (ENV.llmProxyUrl) {
    return normalizeBaseUrl(ENV.llmProxyUrl);
  }

  return `${getApiUrl()}/llm/chat/completions`;
};
