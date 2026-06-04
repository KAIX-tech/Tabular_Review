import {
  callVllmChat,
  extractJsonObject,
  isResponseFormatUnsupported,
  MODEL_IDENTITY_INSTRUCTION,
  type VllmMessage,
  withRetry,
} from "@/shared/api/llm-client";
import { decodeBase64ToText } from "@/shared/lib/encoding";
import type { Column, ExtractionCell } from "@/domains/document-review/model/types";
import type { DocumentFile } from "@/domains/document-review/model/types";

const parseExtractionJson = (text: string): ExtractionCell => {
  const json = JSON.parse(extractJsonObject(text));
  const confidence = ["High", "Medium", "Low"].includes(json.confidence) ? json.confidence : "Low";

  return {
    value: String(json.value || ""),
    confidence,
    quote: String(json.quote || ""),
    page: Number(json.page) || 1,
    reasoning: String(json.reasoning || ""),
    status: "needs_review",
  };
};

export const extractColumnData = async (
  doc: DocumentFile,
  column: Column,
  modelId: string,
): Promise<ExtractionCell> => {
  return withRetry(async () => {
    try {
      const docText = decodeBase64ToText(doc.content);

      let formatInstruction = "";
      switch (column.type) {
        case "date":
          formatInstruction = "Format the date as YYYY-MM-DD.";
          break;
        case "boolean":
          formatInstruction = "Return 'true' or 'false' as the value string.";
          break;
        case "number":
          formatInstruction = "Return a clean number string, removing currency symbols if needed.";
          break;
        case "list":
          formatInstruction = "Return the items as a comma-separated string.";
          break;
        default:
          formatInstruction = "Keep the text concise.";
      }

      const messages: VllmMessage[] = [
        {
          role: "system",
          content: `You are a precise data extraction agent. Extract data exactly as requested and return only valid JSON. ${MODEL_IDENTITY_INSTRUCTION}`,
        },
        {
          role: "user",
          content: `DOCUMENT CONTENT:
${docText}

Task: Extract specific information from the provided document.

Column Name: "${column.name}"
Extraction Instruction: ${column.prompt}

Format Requirements:
- ${formatInstruction}
- Provide a confidence score: High, Medium, or Low.
- Include the exact quote from the text where the answer is found.
- Provide the page number if available; otherwise use 1.
- Provide brief reasoning.

Return ONLY a valid JSON object with this exact shape:
{
  "value": "string",
  "confidence": "High|Medium|Low",
  "quote": "string",
  "page": 1,
  "reasoning": "string"
}`,
        },
      ];

      let responseText: string;
      try {
        responseText = await callVllmChat({
          model: modelId,
          messages,
          temperature: 0,
          responseFormat: "json",
        });
      } catch (error) {
        if (!isResponseFormatUnsupported(error)) throw error;
        responseText = await callVllmChat({
          model: modelId,
          messages,
          temperature: 0,
        });
      }

      return parseExtractionJson(responseText);
    } catch (error) {
      console.error("Extraction error:", error);
      throw error;
    }
  });
};

export const generatePromptHelper = async (
  name: string,
  type: string,
  currentPrompt: string | undefined,
  modelId: string,
): Promise<string> => {
  const prompt = `I need to configure a Large Language Model to extract a specific data field from business documents.

Field Name: "${name}"
Field Type: "${type}"
${currentPrompt ? `Draft Prompt: "${currentPrompt}"` : ""}

Please write a clear, effective prompt that I can send to the LLM to get the best extraction results for this field.
The prompt should describe what to look for and how to handle edge cases if applicable.
Return ONLY the prompt text, no conversational filler.`;

  try {
    const response = await callVllmChat({
      model: modelId,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You write concise, practical extraction prompts for document review workflows. ${MODEL_IDENTITY_INSTRUCTION}`,
        },
        { role: "user", content: prompt },
      ],
    });
    return response.trim();
  } catch (error) {
    console.error("Prompt generation error:", error);
    return currentPrompt || `Extract the ${name} from the document.`;
  }
};
