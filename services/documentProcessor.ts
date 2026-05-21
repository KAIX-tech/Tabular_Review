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
      throw new Error(`Conversion failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.markdown || "";

  } catch (error) {
    console.error("Document Conversion failed:", error);
    throw new Error(`Failed to convert ${file.name}. Is the backend server running?`);
  }
};
