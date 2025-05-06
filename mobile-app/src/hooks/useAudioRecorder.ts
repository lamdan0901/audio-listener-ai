import { useState, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";

// Define available audio input devices interface
export interface AudioInputDevice {
  deviceId: string;
  label: string;
  isDefault?: boolean;
}

// Define audio source types
export type AudioSourceType = "microphone" | "system";

interface AudioRecorderState {
  isRecording: boolean;
  startRecording: () => Promise<boolean | undefined>; // Returns success status
  stopRecording: () => Promise<string | null>; // Returns the URI of the recording
  recordingInstance: Audio.Recording | null;
  permissionResponse: Audio.PermissionResponse | null;
  audioDevices: AudioInputDevice[]; // Available audio devices
  selectedDeviceId: string | null; // Currently selected device
  setAudioDevice: (deviceId: string | null) => void; // Set audio device
  refreshAudioDevices: () => Promise<AudioInputDevice[]>; // Refresh device list
  audioSource: AudioSourceType; // Current audio source
  setAudioSource: (source: AudioSourceType) => void; // Set audio source
  isSystemAudioSupported: () => boolean; // Check if system audio is supported
}

export const useAudioRecorder = (): AudioRecorderState => {
  const [recordingInstance, setRecordingInstance] =
    useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionResponse, setPermissionResponse] =
    useState<Audio.PermissionResponse | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSourceType>("microphone");

  // Ref to track if stopAndUnloadAsync has been called
  const isUnloadingRef = useRef(false);

  // Define recording options for speech recognition
  // Using simpler options that are more likely to work across devices
  const recordingOptions = useRef({
    // Start with the LOW_QUALITY preset which is more compatible across devices
    ...Audio.RecordingOptionsPresets.LOW_QUALITY,

    // Customize for Android
    android: {
      ...Audio.RecordingOptionsPresets.LOW_QUALITY.android,
      // Use MP4 format with the correct extension
      extension: ".mp4", // Match the actual file format
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      // Basic audio settings
      sampleRate: 16000, // 16kHz is standard for speech recognition
      numberOfChannels: 1, // Mono audio
      bitRate: 64000, // Lower bitrate for better compatibility
    },

    // Customize for iOS
    ios: {
      ...Audio.RecordingOptionsPresets.LOW_QUALITY.ios,
      extension: ".m4a", // Use M4A which matches the container format
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC, // AAC in M4A container
      audioQuality: Audio.IOSAudioQuality.LOW, // Lower quality for better compatibility
      sampleRate: 16000, // 16kHz is standard for speech recognition
      numberOfChannels: 1, // Mono audio
      bitRate: 64000, // Lower bitrate for better compatibility
    },

    // Web options
    web: {
      ...Audio.RecordingOptionsPresets.LOW_QUALITY.web,
      mimeType: "audio/webm", // Standard web audio format
      bitsPerSecond: 64000, // Lower bitrate for better compatibility
    },
  }).current;

  // Log the recording options for debugging
  console.log("Recording options:", JSON.stringify(recordingOptions));

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
          // Use the most basic audio mode settings that are likely to work
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            // Don't set any other options to use defaults
          });
          console.log("Audio mode set successfully with basic settings.");

          // Log that audio mode was set
          console.log(
            "Audio mode set successfully, continuing without verification"
          );
        } catch (error) {
          console.error("Failed to set audio mode", error);
          Alert.alert(
            "Audio Setup Error",
            "Could not configure audio settings. Some features may not work correctly."
          );
        }
      }
    };
    requestPermissions();
  }, []);

  const startRecording = async (): Promise<boolean | undefined> => {
    if (permissionResponse?.status !== "granted") {
      Alert.alert(
        "Permissions Required",
        "Cannot start recording without microphone permission."
      );
      console.log("Attempted to record without permission.");
      return false;
    }

    if (isRecording || recordingInstance) {
      console.warn("Recording already in progress or instance exists.");
      // Optionally stop existing before starting new one
      // await stopRecording();
      return false;
    }

    console.log("Starting recording...");
    try {
      // Skip logging current audio mode as getAudioModeAsync is not available
      console.log("Starting recording with current audio mode...");

      // Log the recording options we're using
      console.log("Recording options:", JSON.stringify(recordingOptions));

      // Handle different audio sources
      if (audioSource === "microphone") {
        // Standard microphone recording
        console.log(`Using audio source: ${audioSource}`);

        // If a specific device is selected, we would use it here
        // However, in React Native/Expo, we can't directly select input devices
        // So we just log the selection for now
        if (selectedDeviceId && selectedDeviceId !== "default") {
          console.log(
            `Selected device ID: ${selectedDeviceId} (note: device selection not fully supported in mobile)`
          );
        }

        // Try to set audio mode again right before recording
        try {
          // Use the most basic audio mode settings that are likely to work
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            // Don't set any other options to use defaults
          });
          console.log("Audio mode set successfully right before recording");

          // Unload any existing recording instance to be safe
          if (recordingInstance) {
            console.log(
              "Unloading existing recording instance before starting new one"
            );
            try {
              // Use type assertion to handle the TypeScript error
              const recording = recordingInstance as Audio.Recording | null;
              if (
                recording &&
                typeof recording.stopAndUnloadAsync === "function"
              ) {
                await recording.stopAndUnloadAsync();
              } else {
                console.warn(
                  "Recording instance does not have stopAndUnloadAsync method"
                );
              }
              setRecordingInstance(null);
            } catch (unloadError) {
              console.error("Error unloading existing recording:", unloadError);
              // Continue anyway
            }
          }
        } catch (audioModeError) {
          console.error(
            "Failed to set audio mode before recording:",
            audioModeError
          );
          // Continue anyway
        }

        console.log("Attempting to create recording...");
        // Create the recording with our optimized options
        const { recording } = await Audio.Recording.createAsync(
          recordingOptions
        );
        setRecordingInstance(recording);
        setIsRecording(true);
        console.log("Microphone recording started successfully.");
        return true;
      } else if (audioSource === "system") {
        // System audio recording (if supported)
        if (!isSystemAudioSupported()) {
          console.warn(
            "System audio not supported, falling back to microphone"
          );
          setAudioSource("microphone");

          // Try again with microphone
          const { recording } = await Audio.Recording.createAsync(
            recordingOptions
          );
          setRecordingInstance(recording);
          setIsRecording(true);
          console.log("Fallback to microphone recording started successfully.");
          return true;
        } else {
          // On supported Android devices, we would implement system audio capture here
          // This would typically require a native module or extension
          // For now, we'll just use the microphone as a fallback
          console.log(
            "System audio recording not fully implemented, using microphone"
          );
          const { recording } = await Audio.Recording.createAsync(
            recordingOptions
          );
          setRecordingInstance(recording);
          setIsRecording(true);
          console.log(
            "Recording started with microphone (system audio fallback)."
          );
          return true;
        }
      }
    } catch (err) {
      console.error("Failed to start recording:", err);

      // Get more detailed error information
      const errorMessage =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);

      console.error("Detailed error:", errorMessage);

      // Check for specific error types
      if (errorMessage.includes("permission")) {
        Alert.alert(
          "Permission Error",
          "Microphone permission is required but not granted. Please check your device settings."
        );
      } else if (errorMessage.includes("audio mode")) {
        Alert.alert(
          "Audio Configuration Error",
          "Failed to configure audio settings. Please restart the app and try again."
        );
      } else {
        // Generic error
        Alert.alert(
          "Recording Error",
          `Could not start audio recording: ${errorMessage}`
        );
      }

      // If createAsync fails, there's no new instance to clean up here.
      // The main recordingInstance state is used elsewhere for cleanup if needed.
      setIsRecording(false); // Ensure recording state is reset
      return false;
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
      // Use type assertion to handle TypeScript error
      const recording = recordingInstance as any;
      // Set ref before unloading
      isUnloadingRef.current = true;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("Recording stopped and stored at", uri);

      // Check if the URI is valid
      if (!uri) {
        console.error("Recording URI is null or undefined");
        Alert.alert("Recording Error", "Failed to get recording file URI.");
        setRecordingInstance(null);
        return null;
      }

      // Get file info to verify the recording
      try {
        const fileSystem = require("expo-file-system");
        const fileInfo = await fileSystem.getInfoAsync(uri);
        console.log("Recording file info:", fileInfo);

        // Check if file exists and has content
        if (!fileInfo.exists) {
          console.error("Recording file does not exist");
          Alert.alert("Recording Error", "Recording file not found.");
          setRecordingInstance(null);
          return null;
        }

        if (fileInfo.size === 0) {
          console.error("Recording file is empty (0 bytes)");
          Alert.alert(
            "Recording Error",
            "Recording file is empty. No audio was captured."
          );
          setRecordingInstance(null);
          return null;
        }

        if (fileInfo.size < 1000) {
          console.warn(
            "Warning: Recording file is very small:",
            fileInfo.size,
            "bytes"
          );
        }
      } catch (fileInfoError) {
        console.error("Error checking recording file:", fileInfoError);
        // Continue anyway, as this is just diagnostic
      }

      setRecordingInstance(null); // Clear the instance after stopping
      return uri;
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Recording Error", "Could not stop or save audio recording.");
      setRecordingInstance(null); // Attempt to clear instance even on error
      return null;
    }
  };

  // Function to check if system audio capture is supported on this device
  const isSystemAudioSupported = (): boolean => {
    // System audio capture is only supported on specific platforms and with specific APIs
    // For mobile, we need to check platform-specific capabilities

    // On Android, screen recording with audio is possible on Android 10+ (API 29+)
    if (Platform.OS === "android") {
      // This is a simplified check - in a real implementation, you'd check the API level
      // and possibly use native modules to verify screen recording capabilities
      return Platform.Version >= 29;
    }

    // On iOS, screen recording with audio is more restricted and typically requires
    // a Broadcast Extension or ReplayKit, which is beyond the scope of a simple app
    if (Platform.OS === "ios") {
      return false; // Generally not easily supported in a standard React Native app
    }

    // For other platforms, assume not supported
    return false;
  };

  // Function to refresh the list of available audio devices
  const refreshAudioDevices = async (): Promise<AudioInputDevice[]> => {
    try {
      console.log("Refreshing audio devices...");

      // For mobile devices, we typically can't enumerate audio devices like on desktop
      // Instead, we'll create a simulated list with the default device

      // Create a default device entry
      const defaultDevice: AudioInputDevice = {
        deviceId: "default",
        label: "Default Microphone",
        isDefault: true,
      };

      // On Android, we might be able to get some device info on newer versions
      if (Platform.OS === "android") {
        // In a real implementation, you might use a native module to get actual device info
        const devices: AudioInputDevice[] = [
          defaultDevice,
          // Add any platform-specific devices here if you can detect them
        ];

        setAudioDevices(devices);
        return devices;
      }

      // On iOS, typically just use the default device
      if (Platform.OS === "ios") {
        const devices: AudioInputDevice[] = [defaultDevice];
        setAudioDevices(devices);
        return devices;
      }

      // Fallback for other platforms
      setAudioDevices([defaultDevice]);
      return [defaultDevice];
    } catch (error) {
      console.error("Error refreshing audio devices:", error);
      // Return an empty array on error
      setAudioDevices([]);
      return [];
    }
  };

  // Function to set the audio device
  const setAudioDevice = (deviceId: string | null) => {
    console.log(`Setting audio device: ${deviceId}`);
    setSelectedDeviceId(deviceId);
  };

  // Function to set the audio source
  const handleSetAudioSource = (source: AudioSourceType) => {
    console.log(`Setting audio source: ${source}`);

    // If trying to set system audio but it's not supported, fall back to microphone
    if (source === "system" && !isSystemAudioSupported()) {
      console.warn(
        "System audio capture not supported, falling back to microphone"
      );
      setAudioSource("microphone");
      Alert.alert(
        "Feature Not Supported",
        "System audio capture is not supported on this device. Using microphone instead."
      );
    } else {
      setAudioSource(source);
    }
  };

  // Initialize audio devices on mount
  useEffect(() => {
    refreshAudioDevices();
  }, []);

  // Cleanup recording instance if component unmounts while recording
  useEffect(() => {
    return () => {
      // Only attempt to unload if stopAndUnloadAsync was not called by stopRecording
      if (recordingInstance && !isUnloadingRef.current) {
        console.log("Unmounting: Stopping and unloading recording instance.");
        // Use type assertion to handle TypeScript error
        const recording = recordingInstance as any;
        if (typeof recording.stopAndUnloadAsync === "function") {
          recording
            .stopAndUnloadAsync()
            .catch((err: Error) =>
              console.error("Error stopping recording on unmount:", err)
            );
        }
      }
      // Reset the ref when the effect cleans up
      isUnloadingRef.current = false;
    };
  }, [recordingInstance]); // Depend on recordingInstance to re-run cleanup if instance changes

  return {
    isRecording,
    startRecording,
    stopRecording,
    recordingInstance,
    permissionResponse,
    audioDevices,
    selectedDeviceId,
    setAudioDevice,
    refreshAudioDevices,
    audioSource,
    setAudioSource: handleSetAudioSource,
    isSystemAudioSupported,
  };
};
