import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateRunInput,
  createRun,
  getCell,
  getRun,
  listCells,
  reviewCell,
} from "./extraction.cells.api";

export const cellKeys = {
  byDb: (dbId: string) => ["cells", dbId] as const,
  run: (runId: string) => ["run", runId] as const,
  detail: (cellId: string) => ["cell", cellId] as const,
};

/** One cell with sources (chat drawer 추출값 참조). */
export function useCellDetail(cellId: string | null) {
  return useQuery({
    queryKey: cellKeys.detail(cellId ?? ""),
    queryFn: () => getCell(cellId as string),
    enabled: !!cellId,
  });
}

/** Grid cells. Polls every 2s while a run is active. */
export function useCells(documentDbId: string, active: boolean) {
  return useQuery({
    queryKey: cellKeys.byDb(documentDbId),
    queryFn: () => listCells(documentDbId),
    enabled: !!documentDbId,
    refetchInterval: active ? 2000 : false,
  });
}

/** Poll a run's progress until it finishes. */
export function useRun(runId: string | null) {
  return useQuery({
    queryKey: cellKeys.run(runId ?? ""),
    queryFn: () => getRun(runId as string),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" || status === "canceled" ? false : 2000;
    },
  });
}

export function useCreateRun(documentDbId: string) {
  return useMutation({
    mutationFn: (input: CreateRunInput) => createRun(documentDbId, input),
  });
}

export function useReviewCell(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cellId,
      value,
      reviewStatus,
    }: {
      cellId: string;
      value?: string;
      reviewStatus: "verified" | "edited" | "rejected" | "unreviewed";
    }) => reviewCell(cellId, { value, reviewStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cellKeys.byDb(documentDbId) }),
  });
}
