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
  startRecording: () => Promise<void>;
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

  // Define optimized recording options for speech recognition
  // These match the desktop app settings as closely as possible
  const recordingOptions = useRef({
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    android: {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
      extension: ".webm",
      outputFormat: Audio.AndroidOutputFormat.WEBM,
      audioEncoder: Audio.AndroidAudioEncoder.OPUS,
      sampleRate: 16000, // 16kHz sample rate for speech recognition
      numberOfChannels: 1, // Mono audio
      bitRate: 128000, // 128kbps
    },
    ios: {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
      extension: ".m4a",
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.MEDIUM, // Balance between quality and file size
      sampleRate: 16000, // 16kHz sample rate for speech recognition
      numberOfChannels: 1, // Mono audio
      bitRate: 128000, // 128kbps
      linearPCMBitDepth: 16, // 16-bit
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
      mimeType: "audio/webm",
      bitsPerSecond: 128000,
    },
  }).current;

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

        // Create the recording with our optimized options
        const { recording } = await Audio.Recording.createAsync(
          recordingOptions
        );
        setRecordingInstance(recording);
        setIsRecording(true);
        console.log("Microphone recording started successfully.");
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
        }
      }
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
    audioDevices,
    selectedDeviceId,
    setAudioDevice,
    refreshAudioDevices,
    audioSource,
    setAudioSource: handleSetAudioSource,
    isSystemAudioSupported,
  };
};
