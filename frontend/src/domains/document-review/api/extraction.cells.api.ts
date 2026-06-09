import axios from "axios";
import { z } from "zod";
import { getApiUrl } from "@/shared/api/config";
import type { ExtractionCell, ExtractionResult } from "../model/types";

const cellSourceSchema = z.object({
  chunkId: z.string().nullish(),
  quote: z.string(),
  page: z.number().int().nullish(),
});

const cellSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  columnId: z.string(),
  value: z.string().nullish(),
  valueJson: z.unknown().nullish(),
  confidence: z.enum(["high", "medium", "low"]).nullish(),
  reasoning: z.string().nullish(),
  extractionMethod: z.enum(["full_context", "retrieval_fallback"]).nullish(),
  extractionStatus: z.enum(["idle", "queued", "running", "done", "error"]),
  reviewStatus: z.enum(["unreviewed", "verified", "edited", "rejected"]),
  sources: z.array(cellSourceSchema),
});
type CellDto = z.infer<typeof cellSchema>;

const runSchema = z.object({
  id: z.string(),
  documentDbId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "canceled"]),
  total: z.number().int(),
  done: z.number().int(),
  failed: z.number().int(),
});
export type ExtractionRunDto = z.infer<typeof runSchema>;

const CONFIDENCE: Record<string, ExtractionCell["confidence"]> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function toCell(dto: CellDto): ExtractionCell {
  const src = dto.sources[0];
  const status =
    dto.reviewStatus === "verified"
      ? "verified"
      : dto.reviewStatus === "edited"
        ? "edited"
        : "needs_review";
  return {
    id: dto.id,
    value: dto.value ?? "",
    confidence: dto.confidence ? CONFIDENCE[dto.confidence] : "Low",
    quote: src?.quote ?? "",
    page: src?.page ?? 0,
    reasoning: dto.reasoning ?? "",
    status,
    extractionMethod: dto.extractionMethod ?? undefined,
    extractionStatus: dto.extractionStatus,
  };
}

export async function listCells(documentDbId: string): Promise<ExtractionResult> {
  const { data } = await axios.get(`${getApiUrl()}/document-dbs/${documentDbId}/cells`);
  const cells = z.array(cellSchema).parse(data);
  const result: ExtractionResult = {};
  for (const dto of cells) {
    (result[dto.documentId] ??= {})[dto.columnId] = toCell(dto);
  }
  return result;
}

export interface CreateRunInput {
  documentIds?: string[];
  columnIds?: string[];
  overwriteReviewed?: boolean;
}

export async function createRun(
  documentDbId: string,
  input: CreateRunInput,
): Promise<ExtractionRunDto> {
  const { data } = await axios.post(`${getApiUrl()}/document-dbs/${documentDbId}/runs`, input);
  return runSchema.parse(data);
}

export async function getRun(runId: string): Promise<ExtractionRunDto> {
  const { data } = await axios.get(`${getApiUrl()}/runs/${runId}`);
  return runSchema.parse(data);
}

export async function reviewCell(
  cellId: string,
  input: { value?: string; reviewStatus: "verified" | "edited" | "rejected" | "unreviewed" },
): Promise<void> {
  await axios.patch(`${getApiUrl()}/cells/${cellId}`, input);
}
