import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabular Review",
  description:
    "An AI-powered tabular review tool. Ingest unstructured documents, define dynamic extraction columns, and query your data with an integrated analyst chat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 overflow-hidden h-screen w-screen selection:bg-indigo-100 selection:text-indigo-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
