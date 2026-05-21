const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const getApiUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:18001`;
  }

  return "http://localhost:8000";
};

export const getLlmProxyUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_LLM_PROXY_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  return `${getApiUrl()}/llm/chat/completions`;
};
