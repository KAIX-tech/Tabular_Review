import { z } from "zod";

/**
 * Zod mirrors of the backend chat DTOs (docs/domain-design.md §6.5, camelCase).
 * The UI renders these server shapes directly; the legacy localStorage shapes
 * (role "model", epoch timestamps) are gone with the server migration (PR-C).
 */

export const chatStepSchema = z.object({
  step: z.number(),
  tool: z.string(),
  args: z.record(z.unknown()),
  summary: z.string(),
});

export const chatSourceSchema = z.object({
  id: z.string(),
  kind: z.enum(["chunk", "cell"]),
  chunkId: z.string().nullable(),
  cellId: z.string().nullable(),
  quote: z.string(),
  page: z.number().nullable(),
  rank: z.number(),
  // Display/navigation metadata (may be absent depending on join availability).
  documentName: z.string().nullish(),
  columnName: z.string().nullish(),
  documentId: z.string().nullish(),
  documentDbId: z.string().nullish(),
  columnId: z.string().nullish(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  steps: z.array(chatStepSchema).nullable(),
  sources: z.array(chatSourceSchema),
  createdAt: z.string(),
});

export const chatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  scopeDocumentDbId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const chatSessionDetailSchema = chatSessionSchema.extend({
  messages: z.array(chatMessageSchema),
});

/** SSE `answer` event payload (content + sources of the assistant message). */
export const chatAnswerEventSchema = z.object({
  content: z.string(),
  sources: z.array(chatSourceSchema),
});

export type ChatStep = z.infer<typeof chatStepSchema>;
export type ChatSource = z.infer<typeof chatSourceSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof chatSessionSchema>;
export type ChatSessionDetail = z.infer<typeof chatSessionDetailSchema>;
export type ChatAnswerEvent = z.infer<typeof chatAnswerEventSchema>;
