import { redirect } from "next/navigation";

// Chat-first product: default landing → Agent Chat (docs/domain-design.md §9 #18).
export default function Page() {
  redirect("/chat");
}
