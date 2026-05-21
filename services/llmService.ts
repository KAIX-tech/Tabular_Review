import { DocumentFile, ExtractionCell, Column, ExtractionResult } from "../types";
import { getLlmProxyUrl } from "./apiConfig";

type VllmRole = "system" | "user" | "assistant";

interface VllmMessage {
  role: VllmRole;
  content: string;
}

interface VllmChatOptions {
  model?: string;
  messages: VllmMessage[];
  temperature?: number;
  responseFormat?: "text" | "json";
}

const llmProxyUrl = getLlmProxyUrl();
const defaultModel = import.meta.env.VITE_LLM_MODEL || "glm-5";
const llmTimeoutMs = Number(import.meta.env.VITE_LLM_TIMEOUT_MS || 120000);
const modelIdentityInstruction =
  "If asked about your model, provider, or identity, say you are the on-prem LLM configured for this Tabular Review deployment. Do not claim to be Claude, Gemini, ChatGPT, or any other hosted model unless that identity is explicitly provided by the deployment configuration.";

if (!llmProxyUrl) {
  console.error("VITE_LLM_PROXY_URL is not set in environment variables");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = 5, initialDelay = 1000): Promise<T> {
  let currentTry = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      currentTry++;

      const status = error?.status;
      const isRetryable =
        status === 429 ||
        (typeof status === "number" && status >= 500) ||
        error?.name === "AbortError" ||
        error?.message?.includes("429") ||
        error?.message?.toLowerCase().includes("rate limit") ||
        error?.message?.toLowerCase().includes("quota");

      if (isRetryable && currentTry <= retries) {
        const delay = initialDelay * Math.pow(2, currentTry - 1) + Math.random() * 1000;
        console.warn(`LLM request failed. Retrying attempt ${currentTry} in ${delay.toFixed(0)}ms...`);
        await wait(delay);
        continue;
      }

      throw error;
    }
  }
}

class VllmHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`vLLM request failed with status ${status}: ${body}`);
    this.name = "VllmHttpError";
    this.status = status;
    this.body = body;
  }
}

const resolveModel = (modelId?: string) => modelId || defaultModel;

const decodeDocumentText = (content: string): string => {
  try {
    return decodeURIComponent(escape(atob(content)));
  } catch (e) {
    return atob(content);
  }
};

const normalizeOpenAiContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return "";
};

async function callVllmChat({
  model,
  messages,
  temperature = 0.1,
  responseFormat = "text",
}: VllmChatOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), llmTimeoutMs);

  const body: Record<string, unknown> = {
    model: resolveModel(model),
    messages,
    temperature,
    stream: false,
  };

  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(llmProxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new VllmHttpError(response.status, text);
    }

    const data = JSON.parse(text);
    const content = normalizeOpenAiContent(data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error("Empty response from model");
    }

    return content;
  } finally {
    window.clearTimeout(timeout);
  }
}

const stripJsonCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
};

const extractJsonObject = (text: string): string => {
  const stripped = stripJsonCodeFence(text);
  if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return stripped.slice(start, end + 1);
  }

  return stripped;
};

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

const isResponseFormatUnsupported = (error: unknown): boolean => {
  if (!(error instanceof VllmHttpError)) return false;
  if (error.status !== 400 && error.status !== 422) return false;
  return /response_format|json_object|extra_forbidden|unsupported/i.test(error.body);
};

export const extractColumnData = async (
  doc: DocumentFile,
  column: Column,
  modelId: string
): Promise<ExtractionCell> => {
  return withRetry(async () => {
    try {
      const docText = decodeDocumentText(doc.content);

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
          content:
            `You are a precise data extraction agent. Extract data exactly as requested and return only valid JSON. ${modelIdentityInstruction}`,
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
  modelId: string
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
          content: `You write concise, practical extraction prompts for document review workflows. ${modelIdentityInstruction}`,
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

export const analyzeDataWithChat = async (
  message: string,
  context: { documents: DocumentFile[]; columns: Column[]; results: ExtractionResult },
  history: any[],
  modelId: string
): Promise<string> => {
  let dataContext = "CURRENT EXTRACTION DATA:\n";
  dataContext += `Documents: ${context.documents.map((d) => d.name).join(", ")}\n`;
  dataContext += `Columns: ${context.columns.map((c) => c.name).join(", ")}\n\n`;
  dataContext += "DATA TABLE (CSV Format):\n";

  const headers = ["Document Name", ...context.columns.map((c) => c.name)].join(",");
  dataContext += headers + "\n";

  context.documents.forEach((doc) => {
    const row = [doc.name];
    context.columns.forEach((col) => {
      const cell = context.results[doc.id]?.[col.id];
      const val = cell ? cell.value.replace(/,/g, " ") : "N/A";
      row.push(val);
    });
    dataContext += row.join(",") + "\n";
  });

  const systemInstruction = `You are an intelligent data analyst assistant.
${modelIdentityInstruction}

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
