import { useState, useCallback, useEffect } from "react";
import { HistoryEntry } from "../types/history";
import {
  loadHistory,
  saveHistoryEntry,
  clearAllHistory,
} from "../utils/historyManager";
import { Language, QuestionContext } from "../types/interfaces";

export const useHistoryManager = (
  language: Language,
  questionContext: QuestionContext,
  customContext: string
) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Load history on initial mount
  useEffect(() => {
    const loadInitialHistory = async () => {
      const loadedHistory = await loadHistory();

      // If no history, add a test entry for debugging
      if (loadedHistory.length === 0) {
        console.log("Adding a test history entry for debugging");
        const testEntry: HistoryEntry = {
          id: "test-" + Date.now().toString(),
          timestamp: Date.now(),
          question: "This is a test question",
          answer: "This is a test answer to verify history functionality",
          language: language,
          questionContext: questionContext,
        };
        await saveHistoryEntry(testEntry);
        setHistory([testEntry]);
      } else {
        setHistory(loadedHistory);
      }

      console.log(`Loaded ${loadedHistory.length} history entries.`);
    };
    loadInitialHistory();
  }, []);

  // Add entry to history
  const addEntryToHistory = useCallback(
    (question: string, answer: string) => {
      console.log("addEntryToHistory called with:", { question, answer });

      if (!question || !answer) {
        console.warn("Empty question or answer, not saving to history");
        return;
      }

      // Log current state before adding
      console.log(`Current history length before adding: ${history.length}`);

      const newEntry: HistoryEntry = {
        id: Date.now().toString(), // Simple unique ID
        timestamp: Date.now(),
        question: question,
        answer: answer,
        language: language,
        questionContext: questionContext,
        customContext: customContext || undefined, // Store only if not empty
      };

      console.log("Created new history entry:", newEntry);

      // Important: Directly save and update UI without waiting for async completion
      // This ensures immediate UI feedback
      setHistory((prevHistory) => {
        const updatedHistory = [newEntry, ...prevHistory];
        console.log(
          `Setting history state with ${updatedHistory.length} entries`
        );

        // Then save to AsyncStorage
        saveHistoryEntry(newEntry).then((success) => {
          console.log(
            `History entry ${
              success ? "successfully" : "failed to"
            } save to AsyncStorage`
          );
        });

        return updatedHistory;
      });
    },
    [language, questionContext, customContext] // Remove history.length from dependencies
  );

  // Clear all history
  const handleClearHistory = async () => {
    const cleared = await clearAllHistory();
    if (cleared) {
      setHistory([]); // Update local state
      setShowHistory(false); // Hide history panel after clearing
      console.log("History cleared from state");
    }
    return cleared;
  };

  return {
    history,
    showHistory,
    setShowHistory,
    addEntryToHistory,
    handleClearHistory,
  };
};
