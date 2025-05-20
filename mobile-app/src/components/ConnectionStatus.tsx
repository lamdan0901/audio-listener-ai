import React from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import { styles } from "../screens/MainScreen.style";
import { ConnectionResult } from "../types/interfaces";
import { API_URL } from "@env";
import { diagnoseConnection } from "../services/socketService";
import { checkConnection } from "../utils/connectionHelper";

interface ConnectionStatusProps {
  connectionStatus: ConnectionResult | null;
  setConnectionStatus: React.Dispatch<
    React.SetStateAction<ConnectionResult | null>
  >;
  isConnected: boolean;
  socketId?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionStatus,
  setConnectionStatus,
  isConnected,
  socketId,
}) => {
  if (!connectionStatus) return null;

  const handleDiagnose = async () => {
    setConnectionStatus(null);

    // Run comprehensive diagnostics
    const diagnostics = await diagnoseConnection();
    console.log("Connection diagnostics:", diagnostics);

    // Then check regular connection
    const connection = await checkConnection();
    setConnectionStatus(connection);

    // Show detailed diagnostic information
    Alert.alert(
      connection.success ? "Connection Status" : "Connection Error",
      `${
        connection.success ? "Connected to" : "Could not connect to"
      } the backend server: ${connection.message || ""}\n\n` +
        `URL: ${connection.url || API_URL}\n\n` +
        `Socket Status:\n` +
        `- Socket exists: ${diagnostics.socketExists ? "Yes" : "No"}\n` +
        `- Socket connected: ${diagnostics.socketConnected ? "Yes" : "No"}\n` +
        `- Transport type: ${diagnostics.transportType || "None"}\n\n` +
        `Endpoints:\n` +
        `- Status endpoint: ${
          diagnostics.endpoints.status ? "Reachable" : "Unreachable"
        }\n` +
        `- Socket.IO endpoint: ${
          diagnostics.endpoints.socketIO ? "Reachable" : "Unreachable"
        }\n` +
        `- Root endpoint: ${
          diagnostics.endpoints.root ? "Reachable" : "Unreachable"
        }`,
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
        { text: "OK" },
      ]
    );
  };

  return (
    <View
      style={[
        styles.connectionStatus,
        {
          backgroundColor: connectionStatus.success ? "#4CAF50" : "#F44336",
        },
      ]}
    >
      <View style={styles.connectionStatusTextContainer}>
        <Text style={styles.connectionStatusText}>
          {connectionStatus.success
            ? connectionStatus.isHtmlResponse
              ? `Server running (${connectionStatus.url || API_URL})`
              : `Connected to API (${connectionStatus.url || API_URL})`
            : "Connection error"}
        </Text>
        {connectionStatus.success && connectionStatus.isHtmlResponse && (
          <Text style={styles.connectionStatusSubtext}>
            HTML response detected - API may not be available
          </Text>
        )}
        {!connectionStatus.success && (
          <Text style={styles.connectionStatusSubtext}>
            {connectionStatus.message || "Could not connect to server"}
          </Text>
        )}
        {isConnected && (
          <Text style={styles.connectionStatusSubtext}>
            Socket connected: {socketId || "Unknown"}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={handleDiagnose} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Diagnose</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ConnectionStatus;
