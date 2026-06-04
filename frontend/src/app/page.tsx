import { redirect } from "next/navigation";

// Default landing → Document DB list.
export default function Page() {
  redirect("/document-dbs");
}
