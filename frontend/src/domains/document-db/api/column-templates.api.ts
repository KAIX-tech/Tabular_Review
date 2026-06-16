import type { ColumnType } from "@/domains/document-review";
import { getApiUrl } from "@/shared/api/config";
import axios from "axios";
import { z } from "zod";
import {
  type ColumnTemplate,
  type ColumnTemplateInput,
  type ColumnTemplateResponse,
  columnTemplateResponseSchema,
} from "../model/types";

const GRID_TYPES = new Set<ColumnType>([
  "text",
  "number",
  "date",
  "boolean",
  "list",
  "single_select",
]);

function toTemplate(r: ColumnTemplateResponse): ColumnTemplate {
  // Remaining backend-only types (multi_select) render as "list" (same map as
  // columns.api.ts `toColumn`).
  const type = (GRID_TYPES.has(r.dataType as ColumnType) ? r.dataType : "list") as ColumnType;
  return {
    id: r.id,
    name: r.name,
    type,
    prompt: r.prompt,
    category: r.category ?? undefined,
    options: r.options ?? undefined,
    createdAt: r.createdAt,
  };
}

export async function listColumnTemplates(): Promise<ColumnTemplate[]> {
  const { data } = await axios.get(`${getApiUrl()}/column-templates`);
  return z.array(columnTemplateResponseSchema).parse(data).map(toTemplate);
}

export async function createColumnTemplate(input: ColumnTemplateInput): Promise<ColumnTemplate> {
  const { data } = await axios.post(`${getApiUrl()}/column-templates`, {
    name: input.name,
    dataType: input.type,
    prompt: input.prompt,
    category: input.category ?? null,
    options: input.options ?? null,
  });
  return toTemplate(columnTemplateResponseSchema.parse(data));
}

export async function deleteColumnTemplate(templateId: string): Promise<void> {
  await axios.delete(`${getApiUrl()}/column-templates/${templateId}`);
}

/** Bulk insert (JSON import + one-time localStorage migration). */
export async function importColumnTemplates(
  templates: ColumnTemplateInput[],
): Promise<ColumnTemplate[]> {
  const { data } = await axios.post(`${getApiUrl()}/column-templates:import`, {
    templates: templates.map((t) => ({
      name: t.name,
      dataType: t.type,
      prompt: t.prompt,
      category: t.category ?? null,
      options: t.options ?? null,
    })),
  });
  return z.array(columnTemplateResponseSchema).parse(data).map(toTemplate);
}
