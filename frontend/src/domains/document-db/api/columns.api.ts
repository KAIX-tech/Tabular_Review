import type { Column, ColumnType } from "@/domains/document-review";
import { getApiUrl } from "@/shared/api/config";
import axios from "axios";
import { z } from "zod";
import { type ColumnResponse, columnResponseSchema } from "../model/types";

const GRID_TYPES = new Set<ColumnType>([
  "text",
  "number",
  "date",
  "boolean",
  "list",
  "single_select",
]);

function toColumn(r: ColumnResponse): Column {
  // Remaining backend-only types (multi_select) render as "list".
  const type = (GRID_TYPES.has(r.dataType as ColumnType) ? r.dataType : "list") as ColumnType;
  return {
    id: r.id,
    name: r.name,
    type,
    prompt: r.prompt,
    options: r.options ?? undefined,
    status: "idle",
  };
}

export interface ColumnInput {
  name: string;
  type: ColumnType;
  prompt: string;
  options?: string[];
}

export async function listColumns(documentDbId: string): Promise<Column[]> {
  const { data } = await axios.get(`${getApiUrl()}/document-dbs/${documentDbId}/columns`);
  return z.array(columnResponseSchema).parse(data).map(toColumn);
}

export async function createColumn(documentDbId: string, input: ColumnInput): Promise<Column> {
  const { data } = await axios.post(`${getApiUrl()}/document-dbs/${documentDbId}/columns`, {
    name: input.name,
    dataType: input.type,
    prompt: input.prompt,
    options: input.options ?? null,
  });
  return toColumn(columnResponseSchema.parse(data));
}

export async function updateColumn(columnId: string, input: ColumnInput): Promise<Column> {
  const { data } = await axios.patch(`${getApiUrl()}/columns/${columnId}`, {
    name: input.name,
    dataType: input.type,
    prompt: input.prompt,
    options: input.options ?? null,
  });
  return toColumn(columnResponseSchema.parse(data));
}

export async function deleteColumn(columnId: string): Promise<void> {
  await axios.delete(`${getApiUrl()}/columns/${columnId}`);
}
