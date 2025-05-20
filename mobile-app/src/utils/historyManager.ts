import AsyncStorage from "@react-native-async-storage/async-storage";
import { HistoryEntry } from "../types/history";
import { Alert } from "react-native"; // For confirmation dialog

// Ensure consistent key usage
const HISTORY_KEY = "audioListenerHistory";

/**
 * Loads the history array from AsyncStorage.
 * Returns an empty array if no history is found or on error.
 */
export const loadHistory = async (): Promise<HistoryEntry[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);

    const history = jsonValue != null ? JSON.parse(jsonValue) : [];
    // Ensure data integrity (basic check)
    if (!Array.isArray(history)) {
      console.warn("History data is not an array, resetting.");
      await AsyncStorage.removeItem(HISTORY_KEY);
      return [];
    }
    // Sort by timestamp descending (newest first) just in case
    const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp);
    console.log(`Loaded ${sortedHistory.length} history entries`);
    return sortedHistory;
  } catch (e) {
    console.error("Failed to load history:", e);
    // Consider removing corrupted data
    // await AsyncStorage.removeItem(HISTORY_KEY);
    return [];
  }
};

/**
 * Saves a new entry to the history array in AsyncStorage.
 * Adds the new entry to the beginning of the array.
 */
export const saveHistoryEntry = async (
  entry: HistoryEntry
): Promise<boolean> => {
  if (!entry.question || !entry.answer) {
    console.warn(
      "Attempted to save history entry with missing question or answer."
    );
    return false;
  }

  try {
    // First try to save just this entry as a test
    const singleEntryTest = JSON.stringify([entry]);
    try {
      await AsyncStorage.setItem("historyTest", singleEntryTest);
      console.log("Single entry test save successful");
    } catch (testError) {
      console.error("Single entry test save failed:", testError);
    }

    // Now try to load and update the full history
    try {
      // Try direct set first with a new array
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
      console.log("Successfully saved first history entry");
      return true;
    } catch (directError) {
      console.log(
        "First direct save attempt failed, trying to load existing history"
      );

      // Load existing history and append
      const currentHistory = await loadHistory();
      const updatedHistory = [entry, ...currentHistory];
      const jsonValue = JSON.stringify(updatedHistory);

      try {
        await AsyncStorage.setItem(HISTORY_KEY, jsonValue);
        console.log(
          `History entry saved: ${entry.id}. Total entries: ${updatedHistory.length}`
        );
        return true;
      } catch (setError) {
        console.error("Failed to save history with setItem:", setError);
        return false;
      }
    }
  } catch (e) {
    console.error("Failed to save history entry:", e);
    return false;
  }
};

/**
 * Clears all history from AsyncStorage after confirmation.
 */
export const clearAllHistory = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      "Confirm Clear",
      "Are you sure you want to delete all saved history? This cannot be undone.",
      [
        {
          text: "Cancel",
          onPress: () => {
            console.log("History clear cancelled.");
            resolve(false);
          },
          style: "cancel",
        },
        {
          text: "Clear All",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(HISTORY_KEY);
              console.log("History cleared successfully.");
              resolve(true);
            } catch (e) {
              console.error("Failed to clear history:", e);
              Alert.alert("Error", "Could not clear history.");
              resolve(false);
            }
          },
          style: "destructive",
        },
      ],
      { cancelable: true } // Allow dismissing by tapping outside
    );
  });
};

// TODO: Add functions for downloading history if needed (using expo-file-system)
