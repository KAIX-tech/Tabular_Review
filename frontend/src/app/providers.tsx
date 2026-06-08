"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Next.js App Router + React Query setup (official pattern). On the server a fresh
// client is made per request; in the browser a single stable client is reused
// across renders/remounts. A `useState`-created client can desync observers from
// mutations during streaming/hydration, so the list wouldn't re-render on cache
// changes (new items only showed after a full refresh).
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
