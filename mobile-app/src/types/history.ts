export interface HistoryEntry {
  id: string; // Unique ID, e.g., timestamp or UUID
  timestamp: number; // Unix timestamp
  question: string;
  answer: string;
  language: "en" | "vi";
  questionContext: string; // Keep as string for flexibility
  customContext?: string; // Optional
}
