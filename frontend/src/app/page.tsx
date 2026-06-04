"use client";

import dynamic from "next/dynamic";

// The review workspace is a heavy, browser-only client surface (File System
// Access, drag/drop, base64). Load it client-side to skip SSR entirely.
const ReviewWorkspacePage = dynamic(
  () => import("@/domains/workspace").then((m) => m.ReviewWorkspacePage),
  { ssr: false },
);

export default function Page() {
  return <ReviewWorkspacePage />;
}
