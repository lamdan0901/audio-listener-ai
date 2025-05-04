import * as FileSystem from "expo-file-system";
import { Alert, Platform } from "react-native";
import { API_URL } from "@env"; // Import from @env

// Check if API_URL is loaded correctly
if (!API_URL) {
  console.error(
    "ERROR: API_URL environment variable is not set. Check your .env file and babel config."
  );
}

// Construct base URL for API endpoints (assuming /api/v1 path)
const API_BASE_URL = API_URL
  ? `${API_URL}/api/v1`
  : "http://localhost:3033/api/v1"; // Use loaded URL or fallback

interface RecordingParams {
  language: string;
  questionContext: string;
  customContext: string;
  isFollowUp: boolean;
  audioSource?: string; // 'microphone' or 'system'
  audioDeviceId?: string | null; // Selected audio device ID
}

interface RetryParams extends RecordingParams {
  audioFilePath: string; // Backend expects the path/reference to the audio
}

interface GeminiParams extends RecordingParams {
  audioFile: string; // Backend expects the path/reference to the audio
}

/**
 * Calls the backend endpoint to signal the start of recording.
 * (May not be strictly necessary if backend starts recording on file receipt,
 * but included for parity with web app logic).
 */
export const startRecordingApi = async (
  params: RecordingParams
): Promise<boolean> => {
  const url = `${API_BASE_URL}/recording/start`;
  console.log(`Calling API: POST ${url}`, params);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    console.log("Start recording API call successful.");
    return true;
  } catch (error) {
    console.error("Error calling start recording API:", error);
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("API Error", `Failed to signal start recording: ${message}`);
    return false;
  }
};

/**
 * Uploads the recorded audio file and sends parameters to the stop recording endpoint.
 */
export const stopRecordingAndUpload = async (
  audioUri: string,
  params: RecordingParams
): Promise<boolean> => {
  // Use the upload endpoint instead of stop for better compatibility
  const url = `${API_BASE_URL}/recording/upload`;
  console.log(`Calling API: POST ${url} with file: ${audioUri}`, params);

  try {
    // Check if we're on web platform
    if (Platform.OS === "web") {
      // Web-specific implementation using fetch and FormData
      console.log("Using web-specific upload implementation");

      // For web, audioUri is a blob URL, so we need to fetch the blob first
      const response = await fetch(audioUri);
      const blob = await response.blob();

      // Create FormData and append the blob as a file
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      // Add other parameters as form fields
      formData.append("language", params.language);
      formData.append("questionContext", params.questionContext);
      formData.append("customContext", params.customContext);
      formData.append("isFollowUp", String(params.isFollowUp));
      formData.append("audioSource", params.audioSource || "microphone");
      formData.append("audioDeviceId", params.audioDeviceId || "");

      // Send the FormData using fetch
      const uploadResponse = await fetch(url, {
        method: "POST",
        body: formData,
      });

      console.log("Upload Response:", uploadResponse);

      if (uploadResponse.ok) {
        console.log("Audio uploaded successfully via web implementation.");
        return true;
      } else {
        throw new Error(
          `Upload failed: ${uploadResponse.status} - ${uploadResponse.statusText}`
        );
      }
    } else {
      // Native platform implementation using expo-file-system
      const uploadResult = await FileSystem.uploadAsync(url, audioUri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "audio", // Matches the field name expected by multer on the backend
        parameters: {
          // Send other parameters as form fields
          language: params.language,
          questionContext: params.questionContext,
          customContext: params.customContext,
          isFollowUp: String(params.isFollowUp), // Convert boolean to string for form data
          audioSource: params.audioSource || "microphone", // Include audio source
          audioDeviceId: params.audioDeviceId || "", // Include device ID if available
        },
        headers: {
          // Add any necessary headers, e.g., Authorization
        },
      });

      console.log("Upload Result:", uploadResult);

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        console.log("Audio uploaded successfully.");
        // Backend should now emit socket events for processing, transcript, etc.
        return true;
      } else {
        throw new Error(
          `Upload failed: ${uploadResult.status} - ${uploadResult.body}`
        );
      }
    }
  } catch (error) {
    console.error(
      "Error uploading audio or calling stop recording API:",
      error
    );
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("API Error", `Failed to stop recording and upload: ${message}`);
    return false;
  }
};

/**
 * Calls the backend endpoint to retry transcription for a given audio file.
 * For web platform, we need to re-upload the audio file.
 */
export const retryTranscriptionApi = async (
  params: RetryParams
): Promise<boolean> => {
  try {
    // For web platform, we need to use the retry-upload endpoint with FormData
    if (Platform.OS === "web" && window.lastRecordedAudioBlob) {
      const url = `${API_BASE_URL}/recording/retry-upload`;
      console.log(
        `Calling API: POST ${url} with file re-upload for web platform`
      );

      // Create FormData and append the blob as a file
      const formData = new FormData();
      formData.append("audio", window.lastRecordedAudioBlob, "recording.webm");

      // Add other parameters as form fields
      formData.append("language", params.language);
      formData.append("questionContext", params.questionContext);
      formData.append("customContext", params.customContext);
      formData.append("isFollowUp", String(params.isFollowUp));
      formData.append("audioSource", params.audioSource || "microphone");
      formData.append("audioDeviceId", params.audioDeviceId || "");

      // Send the FormData using fetch
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      console.log(
        "Retry transcription API call successful (web implementation)."
      );
      return true;
    } else {
      // Native platform implementation using the standard retry endpoint
      const url = `${API_BASE_URL}/recording/retry`;
      console.log(`Calling API: POST ${url}`, params);

      // Assuming retry just needs the file path reference and params, not re-upload
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      console.log("Retry transcription API call successful.");
      // Backend should emit socket events
      return true;
    }
  } catch (error) {
    console.error("Error calling retry transcription API:", error);
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("API Error", `Failed to retry transcription: ${message}`);
    return false;
  }
};

/**
 * Calls the backend endpoint to process audio with Gemini.
 * For web platform, we need to re-upload the audio file.
 */
export const processWithGeminiApi = async (
  params: GeminiParams
): Promise<boolean> => {
  try {
    // For web platform, we need to use the gemini-upload endpoint with FormData
    if (Platform.OS === "web" && window.lastRecordedAudioBlob) {
      const url = `${API_BASE_URL}/recording/gemini-upload`;
      console.log(
        `Calling API: POST ${url} with file re-upload for web platform`
      );

      // Create FormData and append the blob as a file
      const formData = new FormData();
      formData.append("audio", window.lastRecordedAudioBlob, "recording.webm");

      // Add other parameters as form fields
      formData.append("language", params.language);
      formData.append("questionContext", params.questionContext);
      formData.append("customContext", params.customContext);
      formData.append("isFollowUp", String(params.isFollowUp));
      formData.append("audioSource", params.audioSource || "microphone");
      formData.append("audioDeviceId", params.audioDeviceId || "");

      // Send the FormData using fetch
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      console.log(
        "Process with Gemini API call successful (web implementation)."
      );
      return true;
    } else {
      // Native platform implementation using the standard Gemini endpoint
      const url = `${API_BASE_URL}/ai/gemini`;
      console.log(`Calling API: POST ${url}`, params);

      // Assuming Gemini endpoint also just needs the file path reference
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      console.log("Process with Gemini API call successful.");
      // Backend should emit socket events
      return true;
    }
  } catch (error) {
    console.error("Error calling process with Gemini API:", error);
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("API Error", `Failed to process with Gemini: ${message}`);
    return false;
  }
};

/**
 * Calls the backend endpoint to cancel an ongoing operation.
 */
export const cancelRequestApi = async (): Promise<boolean> => {
  const url = `${API_BASE_URL}/recording/cancel`;
  console.log(`Calling API: POST ${url}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No body needed for cancel usually
    });
    if (!response.ok) {
      // Don't throw error for cancel if server already finished, maybe just log
      console.warn(
        `Cancel API call returned: ${response.status} ${response.statusText}`
      );
      // throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    console.log("Cancel request API call successful (or ignored).");
    return true;
  } catch (error) {
    console.error("Error calling cancel request API:", error);
    // Don't alert on cancel error, might be expected if process finished
    // Alert.alert('API Error', `Failed to send cancel request: ${error.message}`);
    return false;
  }
};

/**
 * Fetches the initial status from the server (e.g., if there's a last question).
 */
export const getStatusApi = async (): Promise<{
  hasLastQuestion: boolean;
} | null> => {
  const url = `${API_BASE_URL}/status`;
  console.log(`Calling API: GET ${url}`);
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Get status API call successful:", data);
    return data; // Expects { hasLastQuestion: boolean, ... }
  } catch (error) {
    console.error("Error calling get status API:", error);
    // Don't alert for status check failure, just log
    // Alert.alert('API Error', `Failed to get status: ${error.message}`);
    return null;
  }
};
