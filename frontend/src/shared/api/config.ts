import { ENV } from "@/shared/config/env";

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const getApiUrl = (): string => {
  if (ENV.apiUrl) {
    return trimTrailingSlash(ENV.apiUrl);
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:18001`;
  }

  return "http://localhost:8000";
};

export const getLlmProxyUrl = (): string => {
  if (ENV.llmProxyUrl) {
    return trimTrailingSlash(ENV.llmProxyUrl);
  }

  return `${getApiUrl()}/llm/chat/completions`;
};
