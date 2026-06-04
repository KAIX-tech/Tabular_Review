export interface ChatSource {
  documentDb: string;
  documentName: string;
  page: number;
  quote: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  sources?: ChatSource[];
}
