"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDocumentDbs } from "@/domains/document-db";

// /chat with no Document DB selected → land on the first one.
export default function Page() {
  const router = useRouter();
  const { data } = useDocumentDbs();

  useEffect(() => {
    if (data?.[0]) router.replace(`/chat/${data[0].id}`);
  }, [data, router]);

  return (
    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
      Document DB를 선택하세요…
    </div>
  );
}
