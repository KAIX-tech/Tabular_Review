import {
  callVllmChat,
  MODEL_IDENTITY_INSTRUCTION,
  normalizeOpenAiContent,
  type VllmMessage,
} from "@/shared/api/llm-client";
import type { Column, DocumentFile, ExtractionResult } from "@/domains/document-review";

interface ChatHistoryEntry {
  role: "user" | "model";
  parts?: { text: string }[];
  text?: string;
}

export const analyzeDataWithChat = async (
  message: string,
  context: { documents: DocumentFile[]; columns: Column[]; results: ExtractionResult },
  history: ChatHistoryEntry[],
  modelId: string,
): Promise<string> => {
  let dataContext = "CURRENT EXTRACTION DATA:\n";
  dataContext += `Documents: ${context.documents.map((d) => d.name).join(", ")}\n`;
  dataContext += `Columns: ${context.columns.map((c) => c.name).join(", ")}\n\n`;
  dataContext += "DATA TABLE (CSV Format):\n";

  const headers = ["Document Name", ...context.columns.map((c) => c.name)].join(",");
  dataContext += `${headers}\n`;

  context.documents.forEach((doc) => {
    const row = [doc.name];
    context.columns.forEach((col) => {
      const cell = context.results[doc.id]?.[col.id];
      const val = cell ? cell.value.replace(/,/g, " ") : "N/A";
      row.push(val);
    });
    dataContext += `${row.join(",")}\n`;
  });

  const systemInstruction = `You are an intelligent data analyst assistant.
${MODEL_IDENTITY_INSTRUCTION}

You have access to a dataset extracted from documents.

${dataContext}

Instructions:
1. Answer the user's question based strictly on the provided data table.
2. If comparing documents, mention them by name.
3. If the data is missing or N/A, state that clearly.
4. Keep answers professional and concise.`;

  try {
    const chatHistory: VllmMessage[] = history.map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: normalizeOpenAiContent(m.parts?.[0]?.text || m.text || ""),
    }));

    const response = await callVllmChat({
      model: modelId,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemInstruction },
        ...chatHistory,
        { role: "user", content: message },
      ],
    });

    return response || "No response generated.";
  } catch (error) {
    console.error("Chat analysis error:", error);
    return "I apologize, but I encountered an error while analyzing the data. Please try again.";
  }
};
