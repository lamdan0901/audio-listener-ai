import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import {
  SocketUpdateData,
  SocketStreamChunkData,
  SocketErrorData,
} from "../types/interfaces";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HistoryEntry } from "../types/history";

interface UseSocketEventsProps {
  socketInstance: Socket | null;
  setIsLoading: (isLoading: boolean) => void;
  setCanCancel: (canCancel: boolean) => void;
  setQuestionText: (text: string) => void;
  setAnswerText: (text: string) => void;
  setLastAudioFile: (file: string | null) => void;
  setCanRetry: (canRetry: boolean) => void;
  setCanUseGemini: (canUseGemini: boolean) => void;
  setCanFollowUp: (canFollowUp: boolean) => void;
  setIsFollowUp: (isFollowUp: boolean) => void;
  addEntryToHistory: (question: string, answer: string) => void;
  questionText: string;
  answerText: string;
}

// Direct function to save to AsyncStorage as backup method
const saveHistoryDirectly = async (question: string, answer: string) => {
  try {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      question,
      answer,
      language: "en", // Default to English
      questionContext: "general", // Default to general
    };

    // Try to get existing history
    const existingData = await AsyncStorage.getItem("audioListenerHistory");
    let history = [];

    if (existingData) {
      try {
        history = JSON.parse(existingData);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (e) {
        console.error("Error parsing existing history:", e);
        history = [];
      }
    }

    // Add new entry to beginning
    history = [entry, ...history];

    // Save back to AsyncStorage
    await AsyncStorage.setItem("audioListenerHistory", JSON.stringify(history));
    return true;
  } catch (e) {
    console.error("Error directly saving history:", e);
    return false;
  }
};

export const useSocketEvents = ({
  socketInstance,
  setIsLoading,
  setCanCancel,
  setQuestionText,
  setAnswerText,
  setLastAudioFile,
  setCanRetry,
  setCanUseGemini,
  setCanFollowUp,
  setIsFollowUp,
  addEntryToHistory,
  questionText,
  answerText,
}: UseSocketEventsProps) => {
  const originalQuestionRef = useRef<string | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // For debugging
  const lastDataRef = useRef<{
    question: string | null;
    answer: string | null;
    timestamp: number;
  }>({
    question: null,
    answer: null,
    timestamp: 0,
  });

  // Keep track of the most recent valid question
  const capturedQuestionRef = useRef<string>("");

  // For streaming response
  const accumulatedAnswerRef = useRef<string>("");
  const isStreamingRef = useRef<boolean>(false);
  const streamStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!socketInstance) return;

    const handleProcessing = () => {
      console.log("Socket: processing");
    };

    const handleUpdate = (data: SocketUpdateData) => {
      console.log("Socket: update");
      if (isCancelledRef.current) {
        isCancelledRef.current = false;
        return;
      }
      setIsLoading(false);
      setCanCancel(false);

      if (!data.processedWithGemini && data.transcript) {
        originalQuestionRef.current = data.transcript;
      }
      const displayQuestion =
        data.processedWithGemini && originalQuestionRef.current
          ? originalQuestionRef.current
          : data.transcript ?? "";
      const finalAnswer = data.answer ?? "";

      // Store the data for debugging
      lastDataRef.current = {
        question: displayQuestion,
        answer: finalAnswer,
        timestamp: Date.now(),
      };

      // Save the question for later use
      if (displayQuestion) {
        capturedQuestionRef.current = displayQuestion;
      }

      setQuestionText(displayQuestion);
      setAnswerText(finalAnswer);

      if (data.audioFile) setLastAudioFile(data.audioFile);
      setCanRetry(!!data.audioFile);
      setCanUseGemini(!!data.audioFile && !data.processedWithGemini);

      const hasValidQuestion = displayQuestion.trim() !== "";
      setCanFollowUp(hasValidQuestion);
      if (hasValidQuestion) setIsFollowUp(false);

      // Save to history
      if (displayQuestion && finalAnswer) {
        try {
          addEntryToHistory(displayQuestion, finalAnswer);

          // Also try direct save as backup
          saveHistoryDirectly(displayQuestion, finalAnswer);
        } catch (error) {
          console.error("Error saving to history:", error);

          // Try direct save as fallback
          saveHistoryDirectly(displayQuestion, finalAnswer);
        }
      }
    };

    const handleError = (data: SocketErrorData) => {
      console.log("Socket: error", data);
      setIsLoading(false);
      setCanCancel(false);
    };

    const handleTranscript = (data: SocketUpdateData) => {
      console.log("Socket: transcript");
      // Capture transcript as potential question
      if (data.transcript) {
        capturedQuestionRef.current = data.transcript;
      }
    };

    const handleStreamStart = () => {
      console.log("Socket: streamStart");

      // Initialize streaming state
      isStreamingRef.current = true;
      accumulatedAnswerRef.current = "";
      streamStartTimeRef.current = Date.now();

      // Update UI to show streaming is starting
      setIsLoading(false); // No longer loading, now streaming
      setCanCancel(true); // Allow canceling during streaming

      // Set initial answer text to show streaming is starting
      setAnswerText("▋"); // Blinking cursor effect
    };

    const handleStreamChunk = (data: SocketStreamChunkData) => {
      if (!isStreamingRef.current) {
        handleStreamStart(); // Initialize streaming if not already done
      }

      if (isCancelledRef.current) {
        return;
      }

      // Append the new chunk to our accumulated answer
      if (data.chunk) {
        accumulatedAnswerRef.current += data.chunk;

        // Update the UI with the accumulated text so far
        setAnswerText(accumulatedAnswerRef.current + "▋"); // Add cursor at the end
      }
    };

    const handleStreamEnd = (data: SocketUpdateData) => {
      console.log("Socket: streamEnd");
      if (isCancelledRef.current) {
        isCancelledRef.current = false;
        return;
      }
      setIsLoading(false);
      setCanCancel(false);

      // End streaming mode
      isStreamingRef.current = false;

      // Use fullAnswer if provided, otherwise use accumulated answer from streaming
      const finalAnswer =
        data.fullAnswer || accumulatedAnswerRef.current || answerText;

      // Update the UI with the final answer (without cursor)
      setAnswerText(finalAnswer);

      // Get question from various sources
      // 1. From data.transcript if available
      // 2. From capturedQuestionRef if we saved it earlier
      // 3. From current questionText state
      // 4. From originalQuestionRef as last resort
      const currentQuestion =
        data.transcript ||
        capturedQuestionRef.current ||
        questionText ||
        originalQuestionRef.current ||
        "Unknown question";

      // Update the question text if we have a better source
      if (currentQuestion && (!questionText || questionText.trim() === "")) {
        setQuestionText(currentQuestion);
      }

      // Store the data for debugging
      lastDataRef.current = {
        question: currentQuestion,
        answer: finalAnswer,
        timestamp: Date.now(),
      };

      if (data.audioFile) setLastAudioFile(data.audioFile);
      setCanRetry(!!data.audioFile);
      setCanUseGemini(!!data.audioFile && !data.processedWithGemini);

      const hasValidQuestion = currentQuestion.trim() !== "";
      setCanFollowUp(hasValidQuestion);
      if (hasValidQuestion) setIsFollowUp(false);

      // Save to history (use finalAnswer)
      if (currentQuestion && finalAnswer) {
        try {
          // Create a direct copy to avoid reference issues
          const q = String(currentQuestion);
          const a = String(finalAnswer);
          addEntryToHistory(q, a);

          // Also try direct save as backup
          saveHistoryDirectly(q, a);
        } catch (error) {
          console.error("Error saving to history:", error);

          // Try direct save as fallback
          saveHistoryDirectly(currentQuestion, finalAnswer);
        }
      }
    };

    const handleStreamError = (data: SocketErrorData) => {
      console.log("Socket: streamError", data);
      setIsLoading(false);
      setCanCancel(false);
      isStreamingRef.current = false; // End streaming mode

      // Display error in the answer area
      setAnswerText(
        `Error during streaming: ${data.message || "Unknown error"}`
      );
    };

    // Register listeners
    socketInstance.on("processing", handleProcessing);
    socketInstance.on("update", handleUpdate);
    socketInstance.on("error", handleError);
    socketInstance.on("transcript", handleTranscript);
    socketInstance.on("streamStart", handleStreamStart);
    socketInstance.on("streamChunk", handleStreamChunk);
    socketInstance.on("streamEnd", handleStreamEnd);
    socketInstance.on("streamError", handleStreamError);

    // Cleanup listeners
    return () => {
      console.log("Cleaning up socket listeners");
      socketInstance.off("processing", handleProcessing);
      socketInstance.off("update", handleUpdate);
      socketInstance.off("error", handleError);
      socketInstance.off("transcript", handleTranscript);
      socketInstance.off("streamStart", handleStreamStart);
      socketInstance.off("streamChunk", handleStreamChunk);
      socketInstance.off("streamEnd", handleStreamEnd);
      socketInstance.off("streamError", handleStreamError);
    };
  }, [
    socketInstance,
    setIsLoading,
    setCanCancel,
    setQuestionText,
    setAnswerText,
    setLastAudioFile,
    setCanRetry,
    setCanUseGemini,
    setCanFollowUp,
    setIsFollowUp,
    addEntryToHistory,
    questionText,
    answerText,
  ]);

  // Add a direct method to check last data
  const getLastEventData = () => {
    return lastDataRef.current;
  };

  return { isCancelledRef, getLastEventData };
};
