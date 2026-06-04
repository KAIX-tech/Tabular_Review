"use client";

import { useParams } from "next/navigation";
import { ChatMainPage } from "@/domains/chat";

// U-0: chat-first surface for a Document DB.
export default function Page() {
  const { dbId } = useParams<{ dbId: string }>();
  return <ChatMainPage dbId={dbId} />;
}
