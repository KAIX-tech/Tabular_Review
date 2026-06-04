export interface ChatSource {
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
