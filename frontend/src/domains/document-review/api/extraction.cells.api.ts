import { getApiUrl } from "@/shared/api/config";
import axios from "axios";
import { z } from "zod";
import {
  type CellDto,
  type ExtractionCell,
  type ExtractionResult,
  type ExtractionRunDto,
  cellSchema,
  extractionRunSchema,
} from "../model/types";

export type { ExtractionRunDto } from "../model/types";

const CONFIDENCE: Record<string, NonNullable<ExtractionCell["confidence"]>> = {
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
    valueJson: dto.valueJson ?? undefined,
    // Preserve unknown confidence (don't downgrade null to "Low").
    confidence: dto.confidence != null ? CONFIDENCE[dto.confidence] : undefined,
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
  return extractionRunSchema.parse(data);
}

export async function getRun(runId: string): Promise<ExtractionRunDto> {
  const { data } = await axios.get(`${getApiUrl()}/runs/${runId}`);
  return extractionRunSchema.parse(data);
}

export async function reviewCell(
  cellId: string,
  input: { value?: string; reviewStatus: "verified" | "edited" | "rejected" | "unreviewed" },
): Promise<void> {
  await axios.patch(`${getApiUrl()}/cells/${cellId}`, input);
}
