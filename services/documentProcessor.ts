import { getApiUrl } from "./apiConfig";

export const processDocumentToMarkdown = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // Send to local backend running Docling
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/convert`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const errorBody = await response.json();
        detail = errorBody.detail || detail;
      } catch {
        const errorText = await response.text();
        detail = errorText || detail;
      }
      throw new Error(`Conversion failed: ${detail}`);
    }

    const data = await response.json();
    return data.markdown || "";

  } catch (error) {
    console.error("Document Conversion failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert ${file.name}: ${message}`);
  }
};
