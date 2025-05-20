import { useState, useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { API_URL } from "@env";
import { useSocket } from "./useSocket";
import { useAudioRecorder } from "./useAudioRecorder";
import {
  clearAudioFilesApi,
  stopRecordingAndUpload,
  retryTranscriptionApi,
  processWithGeminiApi,
  cancelRequestApi,
  getStatusApi,
} from "../services/apiService";
import {
  checkAndFixSocketConnection,
  reconnectSocket,
  diagnoseConnection,
  checkServerReachability,
} from "../services/socketService";
import { storeAudioBlob } from "../utils/webAudioUtils";
import {
  Language,
  QuestionContext,
  AudioSourceType,
  Status,
} from "../types/interfaces";

interface UseRecordingActionsProps {
  language: Language;
  questionContext: QuestionContext;
  customContext: string;
  isFollowUp: boolean;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingMessage: (message: string) => void;
  setCanCancel: (canCancel: boolean) => void;
  setStatus: React.Dispatch<React.SetStateAction<Status>>;
  setQuestionText: (text: string) => void;
  setAnswerText: (text: string) => void;
  setCanRetry: (canRetry: boolean) => void;
  setCanUseGemini: (canUseGemini: boolean) => void;
  setLastAudioFile: (file: string | null) => void;
  setCanFollowUp: (canFollowUp: boolean) => void;
  setIsFollowUp: (isFollowUp: boolean) => void;
  setConnectionStatus: (status: any) => void;
  lastAudioFile: string | null;
  canRetry: boolean;
  canUseGemini: boolean;
  canCancel: boolean;
  isCancelledRef: React.MutableRefObject<boolean>;
}

export const useRecordingActions = ({
  language,
  questionContext,
  customContext,
  isFollowUp,
  setIsLoading,
  setLoadingMessage,
  setCanCancel,
  setStatus,
  setQuestionText,
  setAnswerText,
  setCanRetry,
  setCanUseGemini,
  setLastAudioFile,
  setCanFollowUp,
  setIsFollowUp,
  setConnectionStatus,
  lastAudioFile,
  canRetry,
  canUseGemini,
  canCancel,
  isCancelledRef,
}: UseRecordingActionsProps) => {
  const { socketInstance, isConnected } = useSocket();
  const {
    isRecording,
    startRecording,
    stopRecording,
    permissionResponse,
    audioDevices,
    selectedDeviceId,
    setAudioDevice,
    refreshAudioDevices,
    audioSource,
    setAudioSource,
    isSystemAudioSupported,
  } = useAudioRecorder();

  // Function to handle socket reconnection
  const handleReconnectSocket = async () => {
    setStatus("connecting");
    setLoadingMessage("Reconnecting to server...");

    try {
      // Run comprehensive connection diagnostics
      console.log("Running connection diagnostics...");
      const diagnostics = await diagnoseConnection();
      console.log("Connection diagnostics:", diagnostics);

      if (!diagnostics.serverReachable) {
        console.error("Server is not reachable");

        // Show detailed diagnostic information
        Alert.alert(
          "Server Unreachable",
          `Could not reach the server at ${API_URL}.\n\nDiagnostic details:\n` +
            `- Status endpoint: ${
              diagnostics.endpoints.status ? "Reachable" : "Unreachable"
            }\n` +
            `- Socket.IO endpoint: ${
              diagnostics.endpoints.socketIO ? "Reachable" : "Unreachable"
            }\n` +
            `- Root endpoint: ${
              diagnostics.endpoints.root ? "Reachable" : "Unreachable"
            }\n` +
            `- Network online: ${
              diagnostics.networkInfo.online ? "Yes" : "No"
            }\n` +
            `- Platform: ${diagnostics.networkInfo.platform}`,
          [
            {
              text: "View Full Diagnostics",
              onPress: () => {
                Alert.alert(
                  "Connection Diagnostics",
                  JSON.stringify(diagnostics, null, 2),
                  [{ text: "OK" }]
                );
              },
            },
            {
              text: "Check Network Settings",
              onPress: () => {
                // On Android, this will open network settings
                if (Platform.OS === "android") {
                  try {
                    // This requires the appropriate permissions in AndroidManifest.xml
                    // Linking.sendIntent('android.settings.WIRELESS_SETTINGS');
                    Alert.alert("Please check your network settings manually");
                  } catch (err) {
                    Alert.alert("Please check your network settings manually");
                  }
                } else {
                  // On iOS, just show a message
                  Alert.alert("Please check your network settings manually");
                }
              },
            },
            { text: "Try Again", onPress: handleReconnectSocket },
            { text: "Cancel" },
          ]
        );
        setStatus("idle");
        return false;
      }

      // Server is reachable, now check if socket exists and is connected
      if (diagnostics.socketExists && diagnostics.socketConnected) {
        console.log("Socket is already connected");
        Alert.alert(
          "Connection Status",
          "Socket is already connected to the server.\n\n" +
            `Transport type: ${diagnostics.transportType || "Unknown"}`
        );

        // Fetch initial server status
        const initialStatus = await getStatusApi();
        if (initialStatus) {
          setCanFollowUp(initialStatus.hasLastQuestion);
          console.log("Initial server status:", initialStatus);
        }

        setStatus("idle");
        return true;
      }

      // Socket exists but not connected, or doesn't exist
      console.log("Attempting to fix socket connection");

      // Try to reconnect the socket
      const reconnected = await checkAndFixSocketConnection();

      if (reconnected) {
        console.log("Socket reconnected successfully");

        // Run diagnostics again to confirm
        const confirmDiagnostics = await diagnoseConnection();

        Alert.alert(
          "Connection Restored",
          "Successfully reconnected to the server.\n\n" +
            `Transport type: ${confirmDiagnostics.transportType || "Unknown"}`
        );

        // Fetch initial server status
        const initialStatus = await getStatusApi();
        if (initialStatus) {
          setCanFollowUp(initialStatus.hasLastQuestion);
          console.log("Initial server status:", initialStatus);
        }

        return true;
      } else {
        console.error("Failed to reconnect socket");

        // Run diagnostics again to get updated information
        const failedDiagnostics = await diagnoseConnection();

        Alert.alert(
          "Connection Error",
          "Failed to establish socket connection to the server.\n\n" +
            "Diagnostic details:\n" +
            `- Server reachable: ${
              failedDiagnostics.serverReachable ? "Yes" : "No"
            }\n` +
            `- Socket exists: ${
              failedDiagnostics.socketExists ? "Yes" : "No"
            }\n` +
            `- Socket connected: ${
              failedDiagnostics.socketConnected ? "Yes" : "No"
            }\n` +
            `- Transport type: ${failedDiagnostics.transportType || "None"}`,
          [
            {
              text: "View Full Diagnostics",
              onPress: () => {
                Alert.alert(
                  "Connection Diagnostics",
                  JSON.stringify(failedDiagnostics, null, 2),
                  [{ text: "OK" }]
                );
              },
            },
            { text: "Try Again", onPress: handleReconnectSocket },
            { text: "Cancel" },
          ]
        );
        return false;
      }
    } catch (error) {
      console.error("Error reconnecting:", error);
      Alert.alert(
        "Connection Error",
        "An error occurred while trying to reconnect: " +
          (error instanceof Error ? error.message : String(error)),
        [
          { text: "Try Again", onPress: handleReconnectSocket },
          { text: "Cancel" },
        ]
      );
      return false;
    } finally {
      setStatus("idle");
    }
  };

  // Function to handle recording toggle
  const handleToggleRecording = async () => {
    // Check socket connection before recording
    if (!isConnected) {
      const reconnected = await handleReconnectSocket();
      if (!reconnected) {
        Alert.alert(
          "Connection Required",
          "Please reconnect to the server before recording.",
          [
            { text: "Cancel" },
            { text: "Reconnect", onPress: handleReconnectSocket },
          ]
        );
        return;
      }
    }

    if (isRecording) {
      // Stop recording
      setIsLoading(true);
      setLoadingMessage("Processing audio...");

      try {
        // Stop the recording and get the audio file URI
        const audioUri = await stopRecording();

        if (!audioUri) {
          console.error("Failed to get audio URI after stopping recording");
          setIsLoading(false);
          Alert.alert(
            "Recording Error",
            "Failed to process the recorded audio."
          );
          return;
        }

        console.log(`Recording stopped, audio URI: ${audioUri}`);

        // For web platform, store the audio blob for later use in retry/Gemini
        if (Platform.OS === "web") {
          await storeAudioBlob(audioUri);
        }

        // Signal the backend that we're stopping and upload the audio file
        const params = {
          language,
          questionContext,
          customContext,
          isFollowUp,
          audioSource, // Include the audio source
          audioDeviceId: selectedDeviceId, // Include the selected device ID
        };

        // Set UI state for processing
        setCanCancel(true);

        // Upload the audio file to the backend
        const success = await stopRecordingAndUpload(audioUri, params);

        if (!success) {
          console.error("Failed to upload audio to backend");
          setIsLoading(false);
          setCanCancel(false);
          Alert.alert("Upload Error", "Failed to upload audio to the server.");
        }

        // Note: We don't set isLoading to false here because we're waiting for socket events
      } catch (error) {
        console.error("Error in stop recording flow:", error);
        setIsLoading(false);
        setCanCancel(false);
        Alert.alert(
          "Error",
          "An error occurred while processing your recording."
        );
      }
    } else {
      // Start recording
      try {
        // Reset state for new recording
        setQuestionText("");
        setAnswerText("");
        setCanRetry(false);
        setCanUseGemini(false);

        // Clear audio files on the server (optional)
        await clearAudioFilesApi().catch((err) => {
          console.error("Failed to clear audio files:", err);
          // Continue with recording even if clearing files fails
        });

        // Start the actual recording - skip the legacy startRecordingApi call
        const recordingStarted = await startRecording();

        // Only log success if recording actually started
        if (recordingStarted === true) {
          console.log("Recording started successfully");
        } else {
          throw new Error("Start encountered an error: recording not started");
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        Alert.alert(
          "Recording Error",
          "Failed to start recording. Please try again."
        );
      }
    }
  };

  const handleRetry = async () => {
    if (!lastAudioFile || !canRetry) {
      console.warn(
        "Cannot retry: No audio file available or retry not allowed"
      );
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Retrying transcription...");
    setCanCancel(true);

    try {
      const params = {
        language,
        questionContext,
        customContext,
        isFollowUp,
        audioFilePath: lastAudioFile,
        audioSource, // Include the audio source
        audioDeviceId: selectedDeviceId, // Include the selected device ID
      };

      const success = await retryTranscriptionApi(params);

      if (!success) {
        setIsLoading(false);
        setCanCancel(false);
        Alert.alert(
          "Retry Error",
          "Failed to retry transcription. Please try again."
        );
      }
      // Note: We don't set isLoading to false here because we're waiting for socket events
    } catch (error) {
      console.error("Error retrying transcription:", error);
      setIsLoading(false);
      setCanCancel(false);
      Alert.alert("Error", "An error occurred while retrying transcription.");
    }
  };

  const handleGemini = async () => {
    if (!lastAudioFile || !canUseGemini) {
      console.warn(
        "Cannot use Gemini: No audio file available or Gemini not allowed"
      );
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Processing with Gemini AI...");
    setCanCancel(true);

    try {
      const params = {
        language,
        questionContext,
        customContext,
        isFollowUp,
        audioFile: lastAudioFile,
        audioSource, // Include the audio source
        audioDeviceId: selectedDeviceId, // Include the selected device ID
      };

      const success = await processWithGeminiApi(params);

      if (!success) {
        setIsLoading(false);
        setCanCancel(false);
        Alert.alert(
          "Gemini Error",
          "Failed to process with Gemini AI. Please try again."
        );
      }
      // Note: We don't set isLoading to false here because we're waiting for socket events
    } catch (error) {
      console.error("Error processing with Gemini:", error);
      setIsLoading(false);
      setCanCancel(false);
      Alert.alert(
        "Error",
        "An error occurred while processing with Gemini AI."
      );
    }
  };

  const handleCancel = async () => {
    if (!canCancel) {
      console.warn("Cancel not allowed in current state");
      return;
    }

    console.log("Cancelling current operation...");
    isCancelledRef.current = true;

    try {
      await cancelRequestApi();
      setIsLoading(false);
      setCanCancel(false);
      console.log("Request cancelled successfully");
    } catch (error) {
      console.error("Error cancelling request:", error);
      // Still reset UI state even if the cancel request failed
      setIsLoading(false);
      setCanCancel(false);
    }
  };

  return {
    isRecording,
    permissionResponse,
    audioDevices,
    selectedDeviceId,
    setAudioDevice,
    refreshAudioDevices,
    audioSource,
    setAudioSource,
    isSystemAudioSupported,
    handleReconnectSocket,
    handleToggleRecording,
    handleRetry,
    handleGemini,
    handleCancel,
  };
};
