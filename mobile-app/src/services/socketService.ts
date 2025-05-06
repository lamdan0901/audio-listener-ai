import { io, Socket } from "socket.io-client";
import { API_URL } from "@env"; // Import from @env
import { Platform } from "react-native";

// Check if API_URL is loaded correctly
if (!API_URL) {
  console.error(
    "ERROR: API_URL environment variable is not set. Check your .env file and babel config."
  );
  // Optionally throw an error or set a default, but logging is usually sufficient during dev
}

// For Android emulator, ensure we're using 10.0.2.2 instead of 192.168.x.x
let SERVER_URL = API_URL || "http://localhost:3033"; // Use loaded URL or fallback

// Special handling for Android emulator
if (Platform.OS === "android" && SERVER_URL.includes("192.168.")) {
  SERVER_URL = SERVER_URL.replace(/192\.168\.[0-9]+\.[0-9]+/, "10.0.2.2");
  console.log(`Android emulator detected, using modified URL: ${SERVER_URL}`);
}

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Log the server URL for debugging
    console.log(`Attempting to connect to Socket.IO server at: ${SERVER_URL}`);

    // Create the socket with more resilient settings
    try {
      // Parse the URL to check if it's valid
      const url = new URL(SERVER_URL);
      console.log(`Parsed server URL: ${url.toString()}`);

      // Create socket with optimized settings for mobile networks
      socket = io(SERVER_URL, {
        transports: ["polling"], // Use only polling for more reliability on mobile
        reconnectionAttempts: 30, // More attempts
        reconnectionDelay: 500, // Start with shorter delay
        reconnectionDelayMax: 10000, // But allow longer delays for later attempts
        timeout: 10000, // Shorter timeout to fail faster and retry
        autoConnect: true,
        forceNew: true,
        path: "/socket.io", // Explicitly set the path
        extraHeaders: {
          "User-Agent": "MobileApp/1.0", // Add custom header for debugging
        },
        // Add query parameters for debugging
        query: {
          client: "mobile-app",
          timestamp: Date.now().toString(),
        },
      });
    } catch (error) {
      console.error(`Error creating socket with URL ${SERVER_URL}:`, error);
      // Create a fallback socket with localhost
      console.log("Attempting to create socket with fallback URL");
      socket = io("http://localhost:3033", {
        transports: ["polling"],
        reconnectionAttempts: 3,
        timeout: 5000,
      });
    }

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
      console.log("Socket transport type:", socket.io.engine.transport.name);

      // Log additional connection details
      console.log("Socket protocol:", socket.io.engine.transport.protocol);
      console.log("Socket readyState:", socket.io.engine.readyState);

      // Send a ping to test the connection
      socket.emit("ping", { timestamp: Date.now() });
    });

    // Handle the server's connection acknowledgment
    socket.on("connected", (data) => {
      console.log("Server acknowledged connection:", data);

      // After successful connection, try to get status
      try {
        const { getStatusApi } = require("./apiService");
        getStatusApi().catch((err) =>
          console.log("Failed to get initial status after socket connect:", err)
        );
      } catch (e) {
        console.error("Error importing getStatusApi:", e);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      // The socket.io client will automatically try to reconnect
      console.log("Will attempt to reconnect automatically");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      // Try to provide more detailed error information
      if (error.message) {
        console.error("Error details:", error.message);
      }

      // The socket.io client will automatically try to reconnect
      console.log("Will attempt to reconnect automatically");
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

/**
 * Attempts to reconnect the socket if it's disconnected
 * @returns {boolean} True if reconnection was attempted, false if already connected
 */
export const reconnectSocket = (): boolean => {
  if (!socket) {
    console.log("Creating new socket connection");
    getSocket(); // This will create a new socket
    return true;
  } else if (!socket.connected) {
    console.log("Reconnecting existing socket");
    socket.connect();
    return true;
  } else {
    console.log("Socket already connected, no need to reconnect");
    return false;
  }
};

/**
 * Checks if the server is reachable via a simple fetch request
 * @returns {Promise<boolean>} True if server is reachable
 */
export const checkServerReachability = async (): Promise<boolean> => {
  try {
    console.log(`Checking server reachability at: ${SERVER_URL}`);

    // Create a controller to timeout the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Try to access the status endpoint which should be more reliable
    const statusUrl = `${SERVER_URL}/api/v1/status`;
    console.log(`Trying status endpoint: ${statusUrl}`);

    try {
      // Make a fetch request to the status endpoint
      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "MobileApp/1.0",
        },
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      console.log(
        `Status endpoint responded with status: ${statusResponse.status}`
      );
      return statusResponse.status >= 200 && statusResponse.status < 500;
    } catch (statusError) {
      console.error(`Error checking status endpoint:`, statusError);

      // If status endpoint fails, try the root endpoint as fallback
      console.log(`Falling back to root endpoint: ${SERVER_URL}`);

      // Make a simple fetch request to the server root
      const response = await fetch(SERVER_URL, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "MobileApp/1.0",
        },
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      console.log(`Server root responded with status: ${response.status}`);
      return response.status >= 200 && response.status < 500;
    }
  } catch (error) {
    console.error(`Error checking server reachability:`, error);
    return false;
  }
};

/**
 * Checks the socket connection and attempts to fix it if needed
 * @returns {Promise<boolean>} True if socket is connected or reconnection was attempted
 */
export const checkAndFixSocketConnection = async (): Promise<boolean> => {
  // First check if the server is reachable
  const isServerReachable = await checkServerReachability();

  if (!isServerReachable) {
    console.error(
      "Server is not reachable, cannot establish socket connection"
    );
    return false;
  }

  if (!socket) {
    console.log("No socket instance found, creating new one");
    getSocket();
    // Wait a bit for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return socket?.connected || false;
  }

  if (!socket.connected) {
    console.log("Socket exists but not connected, attempting to reconnect");

    // Disconnect and recreate the socket instead of just reconnecting
    disconnectSocket();
    getSocket();

    // Wait a bit for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return socket?.connected || false;
  }

  return true; // Socket exists and is connected
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
