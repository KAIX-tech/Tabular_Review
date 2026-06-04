"use client";

import dynamic from "next/dynamic";

// Global chat across all Document DBs. Client-only (persisted sessions in
// localStorage) to avoid SSR/hydration mismatches.
const ChatMainPage = dynamic(() => import("@/domains/chat").then((m) => m.ChatMainPage), {
  ssr: false,
});

export default function Page() {
  return <ChatMainPage />;
}
