import { useState, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { Audio } from "expo-av";

interface AudioRecorderState {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // Returns the URI of the recording
  recordingInstance: Audio.Recording | null;
  permissionResponse: Audio.PermissionResponse | null;
}

export const useAudioRecorder = (): AudioRecorderState => {
  const [recordingInstance, setRecordingInstance] =
    useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionResponse, setPermissionResponse] =
    useState<Audio.PermissionResponse | null>(null);
  const recordingOptions = useRef(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  ).current; // Or customize options

  // Request permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      console.log("Requesting microphone permissions...");
      const response = await Audio.requestPermissionsAsync();
      setPermissionResponse(response);
      if (response.status !== "granted") {
        Alert.alert(
          "Permissions Required",
          "Microphone access is needed to record audio."
        );
        console.log("Microphone permission not granted.");
      } else {
        console.log("Microphone permission granted.");
        // Configure audio mode for iOS/Android - IMPORTANT for recording
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true, // Optional: Allow playback even in silent mode
            // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX, // Optional
            // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX, // Optional
            // shouldDuckAndroid: true, // Optional
            // playThroughEarpieceAndroid: false, // Optional
          });
          console.log("Audio mode set successfully.");
        } catch (error) {
          console.error("Failed to set audio mode", error);
          Alert.alert(
            "Audio Setup Error",
            "Could not configure audio settings."
          );
        }
      }
    };
    requestPermissions();
  }, []);

  const startRecording = async () => {
    if (permissionResponse?.status !== "granted") {
      Alert.alert(
        "Permissions Required",
        "Cannot start recording without microphone permission."
      );
      console.log("Attempted to record without permission.");
      return;
    }

    if (isRecording || recordingInstance) {
      console.warn("Recording already in progress or instance exists.");
      // Optionally stop existing before starting new one
      // await stopRecording();
      return;
    }

    console.log("Starting recording...");
    try {
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecordingInstance(recording);
      setIsRecording(true);
      console.log("Recording started successfully.");
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Recording Error", "Could not start audio recording.");
      // If createAsync fails, there's no new instance to clean up here.
      // The main recordingInstance state is used elsewhere for cleanup if needed.
      setIsRecording(false); // Ensure recording state is reset
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingInstance) {
      console.warn("No recording instance to stop.");
      return null;
    }

    console.log("Stopping recording...");
    setIsRecording(false); // Update state immediately for UI responsiveness
    try {
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      console.log("Recording stopped and stored at", uri);
      setRecordingInstance(null); // Clear the instance after stopping
      return uri;
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Recording Error", "Could not stop or save audio recording.");
      setRecordingInstance(null); // Attempt to clear instance even on error
      return null;
    }
  };

  // Cleanup recording instance if component unmounts while recording
  useEffect(() => {
    return () => {
      if (recordingInstance) {
        console.log("Unmounting: Stopping and unloading recording instance.");
        recordingInstance.stopAndUnloadAsync();
      }
    };
  }, [recordingInstance]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    recordingInstance,
    permissionResponse,
  };
};
