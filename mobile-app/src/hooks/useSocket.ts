import { useEffect, useState, useRef } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "../services/socketService";
import { API_URL } from "@env";

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

      // Get network information if available
      try {
        const netInfo = {
          online: typeof navigator !== "undefined" && navigator.onLine,
          userAgent: navigator.userAgent,
          url: API_URL,
        };
        console.log("useSocket: Network info:", netInfo);
      } catch (e) {
        console.log("useSocket: Could not get network info");
      }

      // Handle different error types
      const errorMessage = error.message.toLowerCase();

      // Handle websocket errors
      if (errorMessage.includes("websocket")) {
        console.log(
          "useSocket: Websocket error detected, will use polling transport only"
        );

        // Disconnect and recreate the socket with polling transport only
        setTimeout(() => {
          try {
            if (socketRef.current) {
              console.log(
                "useSocket: Disconnecting socket with websocket error"
              );
              socketRef.current.disconnect();
              socketRef.current = null;
            }

            // Import the socket service dynamically
            import("../services/socketService").then(
              ({ getSocket, disconnectSocket }) => {
                console.log(
                  "useSocket: Creating new socket with polling transport only"
                );
                socketRef.current = getSocket();

                // Add a one-time listener to check if connection succeeds
                if (socketRef.current) {
                  socketRef.current.once("connect", () => {
                    console.log(
                      "useSocket: Successfully connected with polling transport"
                    );
                  });

                  // Also set a timeout to check if connection succeeded
                  setTimeout(() => {
                    if (socketRef.current && !socketRef.current.connected) {
                      console.log(
                        "useSocket: Still not connected after retry, will try again"
                      );
                      disconnectSocket();
                      socketRef.current = getSocket();
                    }
                  }, 5000);
                }
              }
            );
          } catch (e) {
            console.error(
              "useSocket: Error recreating socket after websocket error:",
              e
            );
          }
        }, 2000);
      }
      // Handle timeout errors
      else if (errorMessage === "timeout") {
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

            // Try to check server reachability before creating a new socket
            import("../services/socketService")
              .then(({ checkServerReachability }) => {
                checkServerReachability().then((isReachable) => {
                  if (isReachable) {
                    console.log(
                      "useSocket: Server is reachable, creating new socket"
                    );
                    socketRef.current = getSocket();
                  } else {
                    console.error(
                      "useSocket: Server is not reachable, will retry later"
                    );
                    // Schedule another retry after a longer delay
                    setTimeout(() => {
                      console.log(
                        "useSocket: Retrying connection after server unreachable"
                      );
                      socketRef.current = getSocket();
                    }, 5000);
                  }
                });
              })
              .catch((e) => {
                console.error(
                  "useSocket: Error importing checkServerReachability:",
                  e
                );
                // Fallback to just creating a new socket
                console.log(
                  "useSocket: Creating new socket after timeout (fallback)"
                );
                socketRef.current = getSocket();
              });
          } catch (e) {
            console.error(
              "useSocket: Error recreating socket after timeout:",
              e
            );
          }
        }, 2000); // Increased delay before reconnection attempt
      }
      // Handle other errors
      else {
        console.log(
          `useSocket: Generic error detected: ${errorMessage}, attempting to reconnect`
        );

        // Simple reconnection for other errors
        setTimeout(() => {
          try {
            if (socketRef.current) {
              socketRef.current.disconnect();
              socketRef.current = null;
            }
            socketRef.current = getSocket();
          } catch (e) {
            console.error("useSocket: Error during generic reconnection:", e);
          }
        }, 3000);
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
