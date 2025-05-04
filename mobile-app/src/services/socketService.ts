import { io, Socket } from "socket.io-client";
import { API_URL } from "@env"; // Import from @env

// Check if API_URL is loaded correctly
if (!API_URL) {
  console.error(
    "ERROR: API_URL environment variable is not set. Check your .env file and babel config."
  );
  // Optionally throw an error or set a default, but logging is usually sufficient during dev
}

const SERVER_URL = API_URL || "http://localhost:3033"; // Use loaded URL or fallback

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket"], // Force websocket transport
      reconnectionAttempts: 5, // Limit reconnection attempts
      timeout: 10000, // Connection timeout
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      // Optionally handle disconnection logic here
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      // Optionally handle connection errors
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
    console.log("Socket disconnected manually.");
  }
  socket = null; // Allow re-creation if needed
};

// Example function to emit an event (we'll use this later)
// export const emitEvent = (eventName: string, data: any) => {
//   const currentSocket = getSocket();
//   if (currentSocket?.connected) {
//     currentSocket.emit(eventName, data);
//   } else {
//     console.warn('Socket not connected, cannot emit event:', eventName);
//   }
// };
