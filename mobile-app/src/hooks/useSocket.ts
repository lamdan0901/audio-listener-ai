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
      socketRef.current = getSocket();
    }
    const socket = socketRef.current;

    // Set initial connection status
    setIsConnected(socket.connected);

    // Define handlers
    const handleConnect = () => {
      console.log("useSocket: Connected");
      setIsConnected(true);
    };
    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("useSocket: Disconnected", reason);
      setIsConnected(false);
    };
    const handleConnectError = (error: Error) => {
      console.error("useSocket: Connection Error", error);
      setIsConnected(false); // Ensure status reflects error
    };

    // Register listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Cleanup function: remove listeners and potentially disconnect
    return () => {
      console.log("useSocket: Cleaning up listeners");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      // Optional: Decide if you want to disconnect when the hook unmounts
      // If the socket is shared globally (like in socketService),
      // you might not want to disconnect it here unless it's the last component using it.
      // For simplicity now, we won't disconnect automatically on unmount.
      // disconnectSocket();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return { isConnected, socketInstance: socketRef.current };
};
