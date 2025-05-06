import { useEffect, useState, useRef } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "../services/socketService";

interface SocketState {
  isConnected: boolean;
  socketInstance: Socket | null;
}

/**
 * Custom hook to manage the Socket.IO connection lifecycle.
 * Returns the socket instance and connection status.
 */
export const useSocket = (): SocketState => {
  // Use useRef to hold the socket instance to avoid re-renders triggering new connections
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get or create the socket instance only once
    if (!socketRef.current) {
      console.log("useSocket: Initializing socket connection");
      socketRef.current = getSocket();
    }
    const socket = socketRef.current;

    // Set initial connection status
    setIsConnected(socket.connected);

    // Define handlers with enhanced logging and reconnection logic
    const handleConnect = () => {
      console.log("useSocket: Connected with ID:", socket.id);
      setIsConnected(true);
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("useSocket: Disconnected", reason);
      setIsConnected(false);

      // Attempt to reconnect after a short delay if not auto-reconnecting
      if (reason === "io server disconnect") {
        setTimeout(() => {
          console.log("useSocket: Manual reconnection attempt");
          socket.connect();
        }, 3000);
      }
    };

    const handleConnectError = (error: Error) => {
      console.error("useSocket: Connection Error", error);
      setIsConnected(false); // Ensure status reflects error

      // Log more detailed error information
      console.error("useSocket: Error details:", error.message);

      // Handle timeout errors specifically
      if (error.message === "timeout") {
        console.log(
          "useSocket: Timeout error detected, attempting to fix connection"
        );

        // Disconnect and recreate the socket after a short delay
        setTimeout(() => {
          try {
            if (socketRef.current) {
              console.log("useSocket: Disconnecting timed-out socket");
              socketRef.current.disconnect();
              socketRef.current = null;
            }

            console.log("useSocket: Creating new socket after timeout");
            socketRef.current = getSocket();
          } catch (e) {
            console.error(
              "useSocket: Error recreating socket after timeout:",
              e
            );
          }
        }, 1000);
      }
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log(`useSocket: Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log(`useSocket: Reconnection attempt #${attemptNumber}`);
    };

    const handleReconnectError = (error: Error) => {
      console.error("useSocket: Reconnection error:", error);
    };

    const handleReconnectFailed = () => {
      console.error("useSocket: Failed to reconnect after all attempts");
      // Try a different approach - recreate the socket
      disconnectSocket();
      socketRef.current = null;
      setTimeout(() => {
        console.log(
          "useSocket: Creating new socket after reconnection failure"
        );
        socketRef.current = getSocket();
      }, 5000);
    };

    // Define handler for server acknowledgment
    const handleConnected = (data: any) => {
      console.log(
        `useSocket: Server acknowledged connection with ID: ${data.id}`
      );
      setIsConnected(true);
    };

    // Register listeners
    socket.on("connect", handleConnect);
    socket.on("connected", handleConnected); // Add listener for server acknowledgment
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect_error", handleReconnectError);
    socket.on("reconnect_failed", handleReconnectFailed);

    // Cleanup function: remove listeners and potentially disconnect
    return () => {
      console.log("useSocket: Cleaning up listeners");
      socket.off("connect", handleConnect);
      socket.off("connected", handleConnected); // Remove the new listener
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnect", handleReconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("reconnect_error", handleReconnectError);
      socket.off("reconnect_failed", handleReconnectFailed);

      // Optional: Decide if you want to disconnect when the hook unmounts
      // If the socket is shared globally (like in socketService),
      // you might not want to disconnect it here unless it's the last component using it.
      // For simplicity now, we won't disconnect automatically on unmount.
      // disconnectSocket();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return { isConnected, socketInstance: socketRef.current };
};
