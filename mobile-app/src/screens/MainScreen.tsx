import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  Button,
  ActivityIndicator,
  Switch,
  Alert,
  FlatList, // Import FlatList
  TouchableOpacity, // For list items
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Markdown from "react-native-markdown-display";
import { Picker } from "@react-native-picker/picker";
import { useSocket } from "../hooks/useSocket";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import {
  startRecordingApi,
  stopRecordingAndUpload,
  retryTranscriptionApi,
  processWithGeminiApi,
  cancelRequestApi,
  getStatusApi,
} from "../services/apiService";
import { HistoryEntry } from "../types/history"; // Import history type
import {
  // Import history utils
  loadHistory,
  saveHistoryEntry,
  clearAllHistory,
} from "../utils/historyManager";

// Define types
type Status = "idle" | "recording" | "processing" | "error" | "connecting";
type Language = "vi" | "en";
type QuestionContext =
  | "interview"
  | "general"
  | "html/css/javascript"
  | "typescript"
  | "reactjs"
  | "nextjs";

interface SocketUpdateData {
  transcript?: string;
  answer?: string;
  fullAnswer?: string;
  audioFile?: string;
  processedWithGemini?: boolean;
  isFollowUp?: boolean;
}

interface SocketStreamChunkData {
  chunk: string;
}

interface SocketErrorData {
  message?: string;
  error?: string;
}

const MainScreen: React.FC = () => {
  // --- State Variables ---
  const [language, setLanguage] = useState<Language>("en");
  const [questionContext, setQuestionContext] =
    useState<QuestionContext>("general");
  const [customContext, setCustomContext] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing...");
  const [isFollowUp, setIsFollowUp] = useState<boolean>(false);
  const [canFollowUp, setCanFollowUp] = useState<boolean>(false);
  const [canRetry, setCanRetry] = useState<boolean>(false);
  const [canUseGemini, setCanUseGemini] = useState<boolean>(false);
  const [canCancel, setCanCancel] = useState<boolean>(false);

  const [questionText, setQuestionText] = useState<string>("");
  const [answerText, setAnswerText] = useState<string>("");
  const [lastAudioFile, setLastAudioFile] = useState<string | null>(null);
  const originalQuestionRef = useRef<string | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false); // Toggle visibility

  // --- Hooks ---
  const { socketInstance, isConnected } = useSocket();
  const { isRecording, startRecording, stopRecording, permissionResponse } =
    useAudioRecorder();

  // --- Effects ---
  useEffect(() => {
    // Update status based on connection/recording/loading
    if (!isConnected) setStatus("connecting");
    else if (isRecording) setStatus("recording");
    else if (isLoading) setStatus("processing");
    else setStatus("idle");
  }, [isConnected, isRecording, isLoading]);

  useEffect(() => {
    // Load Preferences & Initial Status & History
    const loadInitialData = async () => {
      // Load preferences
      try {
        const savedLang = await AsyncStorage.getItem("language");
        const savedQContext = await AsyncStorage.getItem("questionContext");
        const savedCustomCtx = await AsyncStorage.getItem("customContext");
        if (savedLang) setLanguage(savedLang as Language);
        if (savedQContext) setQuestionContext(savedQContext as QuestionContext);
        if (savedCustomCtx) setCustomContext(savedCustomCtx);
        console.log("Preferences loaded");
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }

      // Fetch initial server status
      const initialStatus = await getStatusApi();
      if (initialStatus) {
        setCanFollowUp(initialStatus.hasLastQuestion);
        console.log("Initial server status:", initialStatus);
      } else {
        console.log("Could not fetch initial server status.");
      }

      // Load history
      const loadedHistory = await loadHistory();
      setHistory(loadedHistory);
      console.log(`Loaded ${loadedHistory.length} history entries.`);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    // Save Preferences
    const savePreferences = async () => {
      try {
        await AsyncStorage.setItem("language", language);
        await AsyncStorage.setItem("questionContext", questionContext);
        await AsyncStorage.setItem("customContext", customContext);
      } catch (e) {
        console.error("Failed to save preferences:", e);
      }
    };
    if (!isRecording && !isLoading) savePreferences();
  }, [language, questionContext, customContext, isRecording, isLoading]);

  // --- Helper to Save History ---
  const addEntryToHistory = useCallback(
    (question: string, answer: string) => {
      if (!question || !answer) return; // Don't save empty entries

      const newEntry: HistoryEntry = {
        id: Date.now().toString(), // Simple unique ID
        timestamp: Date.now(),
        question: question,
        answer: answer,
        language: language,
        questionContext: questionContext,
        customContext: customContext || undefined, // Store only if not empty
      };
      saveHistoryEntry(newEntry).then((success) => {
        if (success) {
          // Add to the top of the local state for immediate UI update
          setHistory((prevHistory) => [newEntry, ...prevHistory]);
        }
      });
    },
    [language, questionContext, customContext]
  ); // Dependencies for the entry data

  // --- Socket Event Handlers ---
  useEffect(() => {
    if (!socketInstance) return;

    const handleProcessing = () => {
      /* ... existing code ... */
    };

    const handleUpdate = (data: SocketUpdateData) => {
      console.log("Socket: update", data);
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

      setQuestionText(displayQuestion);
      setAnswerText(finalAnswer);

      if (data.audioFile) setLastAudioFile(data.audioFile);
      setCanRetry(!!data.audioFile);
      setCanUseGemini(!!data.audioFile && !data.processedWithGemini);

      const hasValidQuestion = displayQuestion.trim() !== "";
      setCanFollowUp(hasValidQuestion);
      if (hasValidQuestion) setIsFollowUp(false);

      // Save to history
      addEntryToHistory(displayQuestion, finalAnswer);
    };

    const handleError = (data: SocketErrorData) => {
      /* ... existing code ... */
    };
    const handleTranscript = (data: SocketUpdateData) => {
      /* ... existing code ... */
    };
    const handleStreamStart = () => {
      /* ... existing code ... */
    };
    const handleStreamChunk = (data: SocketStreamChunkData) => {
      /* ... existing code ... */
    };

    const handleStreamEnd = (data: SocketUpdateData) => {
      console.log("Socket: streamEnd", data);
      if (isCancelledRef.current) {
        isCancelledRef.current = false;
        return;
      }
      setIsLoading(false);
      setCanCancel(false);

      // Use fullAnswer if provided, otherwise use accumulated answerText
      const finalAnswer = data.fullAnswer || answerText;
      if (data.fullAnswer) setAnswerText(data.fullAnswer); // Update state if fullAnswer provided

      if (data.audioFile) setLastAudioFile(data.audioFile);
      setCanRetry(!!lastAudioFile);
      setCanUseGemini(!!lastAudioFile && !data.processedWithGemini);

      const hasValidQuestion = questionText.trim() !== "";
      setCanFollowUp(hasValidQuestion);
      if (hasValidQuestion) setIsFollowUp(false);

      // Save to history (use finalAnswer)
      addEntryToHistory(questionText, finalAnswer);
    };

    const handleStreamError = (data: SocketErrorData) => {
      /* ... existing code ... */
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
    // Include addEntryToHistory and its dependencies (language, questionContext, customContext)
    // Also include answerText and questionText as they are used in streamEnd's history save
  }, [
    socketInstance,
    lastAudioFile,
    questionText,
    answerText,
    addEntryToHistory,
  ]);

  // --- Action Handlers ---
  const handleToggleRecording = async () => {
    /* ... existing code ... */
  };
  const handleRetry = async () => {
    /* ... existing code ... */
  };
  const handleGemini = async () => {
    /* ... existing code ... */
  };
  const handleCancel = async () => {
    /* ... existing code ... */
  };

  const handleClearHistory = async () => {
    const cleared = await clearAllHistory();
    if (cleared) {
      setHistory([]); // Update local state
      setShowHistory(false); // Hide history panel after clearing
    }
  };

  // --- UI Rendering ---
  const renderStatus = () => {
    let statusText = `Status: ${status}`;
    if (permissionResponse && permissionResponse.status !== "granted") {
      statusText = "Status: Mic permission needed";
    } else if (status === "connecting") {
      statusText = "Status: Connecting...";
    }
    return <Text style={styles.statusText}>{statusText}</Text>;
  };

  const renderHistoryItem = ({ item }: { item: HistoryEntry }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => Alert.alert(`Q: ${item.question}`, `A: ${item.answer}`)}
    >
      <Text style={styles.historyQuestion} numberOfLines={2}>
        Q: {item.question}
      </Text>
      <Text style={styles.historyTimestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Use ScrollView for main content, FlatList for history */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Audio Listener AI (Mobile)</Text>

        {/* ... (Language, Context, Custom Context, Status, Follow-up, Buttons) ... */}
        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Language:</Text>
          {/* ... Switch ... */}
        </View>

        {/* Context Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Question Context:</Text>
          <View style={styles.pickerContainer}>
            <Picker /* ... Picker Items ... */ />
          </View>
        </View>

        {/* Custom Context */}
        <View style={styles.section}>
          <Text style={styles.label}>Custom Context:</Text>
          <TextInput /* ... TextInput props ... */ />
        </View>

        {/* Status Display */}
        <View style={styles.statusContainer}>
          {renderStatus()}
          {/* ... ActivityIndicator ... */}
        </View>

        {/* Follow-up Checkbox */}
        <View style={[styles.section, styles.switchContainer]}>
          <Text /* ... Text props ... */>Ask a follow-up question</Text>
          <Switch /* ... Switch props ... */ />
        </View>

        {/* Control Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={isRecording ? "Stop Listening" : "Start Listening"}
            onPress={handleToggleRecording}
            disabled={
              isLoading ||
              !isConnected ||
              permissionResponse?.status !== "granted"
            }
            color={isRecording ? "#dc3545" : "#007bff"}
          />
          <Button
            title="Try Different Recognition"
            onPress={handleRetry}
            disabled={!canRetry || isRecording || isLoading || !isConnected}
          />
          <Button
            title="Try Gemini AI"
            onPress={handleGemini}
            disabled={!canUseGemini || isRecording || isLoading || !isConnected}
          />
          <Button
            title="Cancel"
            onPress={handleCancel}
            disabled={!canCancel}
            color="#6c757d"
          />
        </View>

        {/* Question Area */}
        {questionText ? (
          <View style={styles.section}>
            <Text style={styles.label}>Question:</Text>
            <Text style={styles.resultText}>{questionText}</Text>
          </View>
        ) : null}

        {/* Answer Area */}
        {answerText ? (
          <View style={styles.section}>
            <Text style={styles.label}>Answer:</Text>
            <Markdown style={markdownStyles}>{answerText}</Markdown>
          </View>
        ) : null}

        {/* History Section */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.label}>History</Text>
            <View style={styles.historyButtons}>
              <Button
                title={showHistory ? "Hide" : "Show"}
                onPress={() => setShowHistory(!showHistory)}
                disabled={history.length === 0}
              />
              <Button
                title="Clear All"
                onPress={handleClearHistory}
                color="red"
                disabled={history.length === 0}
              />
            </View>
          </View>
          {showHistory && history.length > 0 && (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              style={styles.historyList}
              nestedScrollEnabled={true} // Important for ScrollView nesting
            />
          )}
          {showHistory && history.length === 0 && (
            <Text style={styles.historyEmptyText}>No history saved yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  // ... (Keep existing styles: container, scrollContent, title, section, label, etc.)
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  picker: {
    height: 50,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyButtons: {
    flexDirection: "row",
    gap: 10, // Add gap between buttons
  },
  historyList: {
    maxHeight: 200, // Limit height to prevent taking too much space
    borderWidth: 1,
    borderColor: "#e9ecef",
    borderRadius: 4,
    backgroundColor: "#fff", // White background for the list
  },
  historyItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  historyQuestion: {
    fontSize: 14,
    fontWeight: "500", // Medium weight
    marginBottom: 3,
  },
  historyTimestamp: {
    fontSize: 12,
    color: "#6c757d", // Grey color for timestamp
  },
  historyEmptyText: {
    textAlign: "center",
    marginTop: 15,
    color: "#6c757d",
    fontStyle: "italic",
  },
  // ... (Keep existing styles: resultText, disabledText, markdownStyles, etc.)
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollContent: { padding: 20, paddingBottom: 50 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#343a40",
  },
  section: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#495057" },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  activeText: { fontWeight: "bold", color: "#007bff" },
  inactiveText: { color: "#6c757d" },
  textArea: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    textAlignVertical: "top",
    backgroundColor: "#fff",
    minHeight: 60,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    marginBottom: 15,
    backgroundColor: "#e9ecef",
    borderRadius: 5,
    minHeight: 50,
  },
  statusText: { fontSize: 16, color: "#495057", marginRight: 5 },
  loader: { marginLeft: 5 },
  loadingText: { fontSize: 14, marginLeft: 5, color: "#495057" },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 20,
    gap: 10,
  },
  resultText: {
    fontSize: 15,
    color: "#212529",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  disabledText: { color: "#adb5bd" },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: "#212529",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  heading1: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#0056b3",
  },
  heading2: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 4,
    color: "#0056b3",
  },
  list_item: { marginBottom: 5 },
  bullet_list: { marginLeft: 15 },
  ordered_list: { marginLeft: 15 },
  code_inline: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: "monospace",
  },
  code_block: {
    backgroundColor: "#e9ecef",
    padding: 10,
    borderRadius: 4,
    fontFamily: "monospace",
    marginVertical: 5,
  },
  fence: {
    backgroundColor: "#e9ecef",
    padding: 10,
    borderRadius: 4,
    fontFamily: "monospace",
    marginVertical: 5,
  },
});

export default MainScreen;
