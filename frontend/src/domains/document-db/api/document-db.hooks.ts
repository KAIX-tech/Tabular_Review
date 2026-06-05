import { useQuery } from "@tanstack/react-query";
import { getDocumentDb, getDocumentDbs } from "./document-db.api";

// Exported query keys for explicit cache contracts (no raw strings at call sites).
export const documentDbKeys = {
  all: ["document-dbs"] as const,
  detail: (id: string) => ["document-dbs", id] as const,
};

export function useDocumentDbs() {
  return useQuery({
    queryKey: documentDbKeys.all,
    queryFn: getDocumentDbs,
  });
}

export function useDocumentDb(id: string) {
  return useQuery({
    queryKey: documentDbKeys.detail(id),
    queryFn: () => getDocumentDb(id),
    enabled: !!id,
  });
}
