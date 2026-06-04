"use client";

import dynamic from "next/dynamic";

// A-1: Tabular Review grid for a Document DB. Browser-only client surface
// (File System Access, drag/drop, base64), so load it client-side without SSR.
const DocumentDbReviewPage = dynamic(
  () => import("@/domains/document-db").then((m) => m.DocumentDbReviewPage),
  { ssr: false },
);

export default function Page() {
  return <DocumentDbReviewPage />;
}
