import { z } from "zod";

export const chatSourceSchema = z.object({
  documentDb: z.string(),
  documentName: z.string(),
  page: z.number(),
  quote: z.string(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "model"]),
  text: z.string(),
  timestamp: z.number(),
  sources: z.array(chatSourceSchema).optional(),
});

export const chatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(chatMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ChatSource = z.infer<typeof chatSourceSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof chatSessionSchema>;
