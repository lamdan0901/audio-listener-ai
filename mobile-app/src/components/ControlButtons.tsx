import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { styles, theme } from "../screens/MainScreen.style";

interface ControlButtonsProps {
  isRecording: boolean;
  isLoading: boolean;
  isConnected: boolean;
  permissionGranted: boolean;
  canRetry: boolean;
  canUseGemini: boolean;
  canCancel: boolean;
  onToggleRecording: () => void;
  onRetry: () => void;
  onGemini: () => void;
  onCancel: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  isRecording,
  isLoading,
  isConnected,
  permissionGranted,
  canRetry,
  canUseGemini,
  canCancel,
  onToggleRecording,
  onRetry,
  onGemini,
  onCancel,
}) => {
  const isButtonDisabled = !isConnected || !permissionGranted || isLoading;

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        style={[
          styles.customButton,
          isRecording ? styles.buttonDanger : styles.buttonPrimary,
          isButtonDisabled && !isRecording && { opacity: 0.6 },
        ]}
        onPress={onToggleRecording}
        disabled={isButtonDisabled && !isRecording}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {isRecording ? "Stop Listening" : "Start Listening"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.customButton,
          styles.buttonSecondary,
          (!canRetry || isRecording || isLoading || !isConnected) && {
            opacity: 0.6,
          },
        ]}
        onPress={onRetry}
        disabled={!canRetry || isRecording || isLoading || !isConnected}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>Try Different Recognition</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.customButton,
          styles.buttonPrimary,
          (!canUseGemini || isRecording || isLoading || !isConnected) && {
            opacity: 0.6,
          },
        ]}
        onPress={onGemini}
        disabled={!canUseGemini || isRecording || isLoading || !isConnected}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>Try Gemini AI</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.customButton,
          styles.buttonSecondary,
          !canCancel && { opacity: 0.6 },
        ]}
        onPress={onCancel}
        disabled={!canCancel}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ControlButtons;
