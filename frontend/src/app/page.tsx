import { redirect } from "next/navigation";

// Default landing → Document DB list (admin). User-facing chat entry comes later.
export default function Page() {
  redirect("/document-dbs");
}
