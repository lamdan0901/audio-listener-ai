import React from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { styles, theme } from "../screens/MainScreen.style";
import { Status } from "../types/interfaces";

interface StatusDisplayProps {
  status: Status;
  permissionGranted: boolean;
  isLoading: boolean;
  loadingMessage: string;
  isConnected: boolean;
  onReconnect: () => void;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  status,
  permissionGranted,
  isLoading,
  loadingMessage,
  isConnected,
  onReconnect,
}) => {
  const renderStatusContent = () => {
    let statusText = `Status: ${status}`;
    if (!permissionGranted) {
      statusText = "Status: Mic permission needed";
    } else if (status === "connecting") {
      statusText = "Status: Connecting...";
    } else if (isLoading && status === "processing") {
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.loader}
          />
          <Text style={styles.loadingText}>
            {loadingMessage || `Status: processing`}
          </Text>
        </View>
      );
    }
    return <Text style={styles.statusText}>{statusText}</Text>;
  };

  return (
    <View style={styles.statusContainer}>
      <View style={{ flex: 1 }}>{renderStatusContent()}</View>

      {!isConnected && (
        <TouchableOpacity
          style={[
            styles.customButton,
            styles.buttonPrimary,
            { paddingVertical: theme.spacing.xs },
          ]}
          onPress={onReconnect}
          disabled={status === "connecting"}
        >
          <Text style={styles.buttonText}>Reconnect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default StatusDisplay;
