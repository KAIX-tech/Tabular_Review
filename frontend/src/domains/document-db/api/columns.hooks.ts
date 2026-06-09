import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnInput,
  createColumn,
  deleteColumn,
  listColumns,
  updateColumn,
} from "./columns.api";

export const columnKeys = {
  byDb: (dbId: string) => ["columns", dbId] as const,
};

export function useColumns(documentDbId: string) {
  return useQuery({
    queryKey: columnKeys.byDb(documentDbId),
    queryFn: () => listColumns(documentDbId),
    enabled: !!documentDbId,
  });
}

export function useCreateColumn(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ColumnInput) => createColumn(documentDbId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.byDb(documentDbId) });
      queryClient.invalidateQueries({ queryKey: ["document-dbs"] });
    },
  });
}

export function useUpdateColumn(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: ColumnInput }) =>
      updateColumn(columnId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: columnKeys.byDb(documentDbId) }),
  });
}

export function useDeleteColumn(documentDbId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.byDb(documentDbId) });
      queryClient.invalidateQueries({ queryKey: ["document-dbs"] });
    },
  });
}
