// Define shared types used across components

export type Status =
  | "idle"
  | "recording"
  | "processing"
  | "error"
  | "connecting";
export type Language = "vi" | "en";
export type QuestionContext =
  | "interview"
  | "general"
  | "html/css/javascript"
  | "typescript"
  | "reactjs"
  | "nextjs";

export type AudioSourceType = "microphone" | "system" | "both";

export interface SocketUpdateData {
  transcript?: string;
  answer?: string;
  fullAnswer?: string;
  audioFile?: string;
  processedWithGemini?: boolean;
  isFollowUp?: boolean;
}

export interface SocketStreamChunkData {
  chunk: string;
}

export interface SocketErrorData {
  message?: string;
  error?: string;
}

export interface ConnectionResult {
  success: boolean;
  message?: string;
  details?: string;
  rawResponse?: string;
  url?: string;
  isHtmlResponse?: boolean;
}
