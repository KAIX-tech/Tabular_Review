import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnTemplateInput } from "../model/types";
import {
  createColumnTemplate,
  deleteColumnTemplate,
  importColumnTemplates,
  listColumnTemplates,
} from "./column-templates.api";

export const columnTemplateKeys = {
  all: ["column-templates"] as const,
};

export function useColumnTemplates() {
  return useQuery({
    queryKey: columnTemplateKeys.all,
    queryFn: listColumnTemplates,
  });
}

export function useCreateColumnTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ColumnTemplateInput) => createColumnTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: columnTemplateKeys.all }),
  });
}

export function useDeleteColumnTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => deleteColumnTemplate(templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: columnTemplateKeys.all }),
  });
}

export function useImportColumnTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templates: ColumnTemplateInput[]) => importColumnTemplates(templates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: columnTemplateKeys.all }),
  });
}
