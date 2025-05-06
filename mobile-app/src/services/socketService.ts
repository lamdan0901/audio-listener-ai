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
// Use the API_URL directly, assuming it's correctly configured for the environment
console.log(`Using server URL for ${Platform.OS}: ${SERVER_URL}`);

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Log the server URL and options for debugging
    const socketOptions = {
      transports: ["polling"], // Use only polling for mobile devices
      reconnectionAttempts: 30, // More attempts
      reconnectionDelay: 1000, // Start with slightly longer delay
      reconnectionDelayMax: 15000, // Allow longer delays for later attempts
      timeout: 30000, // Longer timeout for mobile networks
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
        transport: "polling", // Explicitly request polling transport
      },
    };
    console.log(
      `Attempting to connect to Socket.IO server at: ${SERVER_URL} with options:`,
      socketOptions
    );

    // Create the socket with more resilient settings
    try {
      // Parse the URL to check if it's valid
      const url = new URL(SERVER_URL);
      console.log(`Parsed server URL: ${url.toString()}`);

      // Create socket with optimized settings for mobile networks
      // Use only polling transport for mobile devices to avoid websocket errors
      socket = io(SERVER_URL, socketOptions);
    } catch (error) {
      console.error(`Error creating socket with URL ${SERVER_URL}:`, error);
      // Create a fallback socket with localhost
      console.log("Attempting to create socket with fallback URL");
      socket = io("http://localhost:3033", {
        transports: ["polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        timeout: 30000,
        query: {
          client: "mobile-app-fallback",
          transport: "polling",
        },
      });
    }

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);

      // Safely access socket properties with null checks
      if (
        socket &&
        socket.io &&
        socket.io.engine &&
        socket.io.engine.transport
      ) {
        console.log("Socket transport type:", socket.io.engine.transport.name);

        // Log additional connection details - use type assertion for protocol
        const transport = socket.io.engine.transport as any;
        if (transport && typeof transport.protocol !== "undefined") {
          console.log("Socket protocol:", transport.protocol);
        }

        console.log("Socket readyState:", socket.io.engine.readyState);

        // Send a ping to test the connection
        socket.emit("ping", { timestamp: Date.now() });
      } else {
        console.log("Socket transport information not available");
      }
    });

    // Handle the server's connection acknowledgment
    socket.on("connected", (data) => {
      console.log("Server acknowledged connection:", data);

      // After successful connection, try to get status
      try {
        const { getStatusApi } = require("./apiService");
        getStatusApi().catch((err: Error) =>
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

    // Try multiple endpoints with increased timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10 seconds

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
        // Disable cache to ensure fresh response
        cache: "no-store",
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      console.log(
        `Status endpoint responded with status: ${statusResponse.status}`
      );

      // Try to read the response body for more diagnostics
      try {
        const responseText = await statusResponse.text();
        console.log(
          `Status endpoint response: ${responseText.substring(0, 200)}...`
        );
      } catch (e) {
        console.log(`Could not read status endpoint response body: ${e}`);
      }

      return statusResponse.status >= 200 && statusResponse.status < 500;
    } catch (statusError) {
      console.error(`Error checking status endpoint:`, statusError);

      // If status endpoint fails, try the socket.io endpoint directly
      const socketIOUrl = `${SERVER_URL}/socket.io/?EIO=4&transport=polling`;
      console.log(`Trying Socket.IO endpoint: ${socketIOUrl}`);

      try {
        // Create a new controller for this request
        const socketController = new AbortController();
        const socketTimeoutId = setTimeout(
          () => socketController.abort(),
          10000
        );

        const socketResponse = await fetch(socketIOUrl, {
          method: "GET",
          signal: socketController.signal,
          headers: {
            Accept: "*/*",
            "User-Agent": "MobileApp/1.0",
          },
          cache: "no-store",
        });

        clearTimeout(socketTimeoutId);

        console.log(
          `Socket.IO endpoint responded with status: ${socketResponse.status}`
        );

        // Try to read the response body for more diagnostics
        try {
          const responseText = await socketResponse.text();
          console.log(
            `Socket.IO endpoint response: ${responseText.substring(0, 200)}...`
          );
          // If we got a response from the Socket.IO endpoint, the server is reachable
          return true;
        } catch (e) {
          console.log(`Could not read Socket.IO endpoint response body: ${e}`);
        }
      } catch (socketError) {
        console.error(`Error checking Socket.IO endpoint:`, socketError);
      }

      // If both status and Socket.IO endpoints fail, try the root endpoint as final fallback
      console.log(`Falling back to root endpoint: ${SERVER_URL}`);

      // Make a simple fetch request to the server root
      try {
        // Create a new controller for this request
        const rootController = new AbortController();
        const rootTimeoutId = setTimeout(() => rootController.abort(), 10000);

        const response = await fetch(SERVER_URL, {
          method: "GET",
          signal: rootController.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "MobileApp/1.0",
          },
          cache: "no-store",
        });

        clearTimeout(rootTimeoutId);

        console.log(`Server root responded with status: ${response.status}`);
        return response.status >= 200 && response.status < 500;
      } catch (rootError) {
        console.error(`Error checking root endpoint:`, rootError);
        return false;
      }
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
  console.log("Checking and fixing socket connection if needed");

  // First check if the server is reachable
  const isServerReachable = await checkServerReachability();

  if (!isServerReachable) {
    console.error(
      "Server is not reachable, cannot establish socket connection"
    );
    return false;
  }

  console.log("Server is reachable, checking socket connection");

  // If socket doesn't exist, create a new one
  if (!socket) {
    console.log("No socket instance found, creating new one");
    getSocket();

    // Wait longer for connection to establish on mobile networks
    console.log("Waiting for socket connection to establish...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Use type assertion to access connected property
    const isConnected = socket ? (socket as any).connected || false : false;
    console.log(`Socket connection established: ${isConnected}`);

    if (!isConnected) {
      console.log(
        "Socket failed to connect on first attempt, trying again with different transport"
      );

      // Try again with a different configuration
      disconnectSocket();

      try {
        // Create socket with polling transport only
        socket = io(SERVER_URL, {
          transports: ["polling"], // Use only polling to avoid websocket errors
          reconnectionAttempts: 30,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 15000,
          timeout: 30000,
          autoConnect: true,
          forceNew: true,
          query: {
            client: "mobile-app-reconnect",
            transport: "polling",
            timestamp: Date.now().toString(),
          },
        });

        // Wait for connection
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return socket?.connected || false;
      } catch (e) {
        console.error("Error creating socket with alternate transport:", e);
        return false;
      }
    }

    return isConnected;
  }

  // If socket exists but is not connected, try to reconnect
  if (!socket.connected) {
    console.log("Socket exists but not connected, attempting to reconnect");

    // Disconnect and recreate the socket instead of just reconnecting
    disconnectSocket();

    // Try a different approach - create socket with explicit ping configuration
    try {
      console.log("Creating new socket with explicit ping configuration");
      socket = io(SERVER_URL, {
        transports: ["polling"], // Use only polling to avoid websocket errors
        reconnectionAttempts: 30,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        timeout: 30000,
        autoConnect: true,
        forceNew: true,
        // Use type assertion to add non-standard options
        ...({
          pingInterval: 10000, // More frequent pings
          pingTimeout: 15000, // Longer ping timeout
        } as any),
        query: {
          client: "mobile-app-reconnect-2",
          transport: "polling",
          timestamp: Date.now().toString(),
        },
      });

      // Wait for connection
      console.log("Waiting for reconnection...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Use type assertion to access connected property
      const isReconnected = socket ? (socket as any).connected || false : false;
      console.log(`Socket reconnection result: ${isReconnected}`);

      return isReconnected;
    } catch (e) {
      console.error("Error recreating socket with ping configuration:", e);

      // Last resort - try the default getSocket again
      console.log("Trying default socket creation as last resort");
      getSocket();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Use type assertion to access connected property
      return socket ? (socket as any).connected || false : false;
    }
  }

  console.log("Socket is already connected");
  return true; // Socket exists and is connected
};

/**
 * Diagnoses connection issues and returns detailed information
 * @returns {Promise<object>} Diagnostic information
 */
export const diagnoseConnection = async (): Promise<{
  serverReachable: boolean;
  socketExists: boolean;
  socketConnected: boolean;
  transportType: string | null;
  serverUrl: string;
  endpoints: {
    status: boolean;
    socketIO: boolean;
    root: boolean;
  };
  networkInfo: any;
}> => {
  console.log("Running connection diagnostics");

  // Check server reachability for each endpoint
  let statusEndpointReachable = false;
  let socketIOEndpointReachable = false;
  let rootEndpointReachable = false;

  // Try status endpoint
  try {
    const statusUrl = `${SERVER_URL}/api/v1/status`;
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    statusEndpointReachable =
      statusResponse.status >= 200 && statusResponse.status < 500;
  } catch (e) {
    console.log("Status endpoint check failed:", e);
  }

  // Try Socket.IO endpoint
  try {
    const socketIOUrl = `${SERVER_URL}/socket.io/?EIO=4&transport=polling`;
    const socketIOResponse = await fetch(socketIOUrl, {
      method: "GET",
      headers: { Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    socketIOEndpointReachable =
      socketIOResponse.status >= 200 && socketIOResponse.status < 500;
  } catch (e) {
    console.log("Socket.IO endpoint check failed:", e);
  }

  // Try root endpoint
  try {
    const rootResponse = await fetch(SERVER_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    rootEndpointReachable =
      rootResponse.status >= 200 && rootResponse.status < 500;
  } catch (e) {
    console.log("Root endpoint check failed:", e);
  }

  // Get network info
  let networkInfo = {};
  try {
    networkInfo = {
      online: typeof navigator !== "undefined" && navigator.onLine,
      userAgent: navigator.userAgent,
      url: SERVER_URL,
      platform: Platform.OS,
      // Try to detect websocket support
      websocketSupport: {
        available: typeof WebSocket !== "undefined",
        secure:
          typeof window !== "undefined" &&
          window.location?.protocol === "https:",
      },
    };
  } catch (e) {
    console.log("Could not get network info:", e);
  }

  // Compile diagnostic information
  const diagnostics = {
    serverReachable:
      statusEndpointReachable ||
      socketIOEndpointReachable ||
      rootEndpointReachable,
    socketExists: !!socket,
    socketConnected: socket ? (socket as any).connected || false : false,
    transportType: socket?.io?.engine?.transport?.name || null,
    serverUrl: SERVER_URL,
    endpoints: {
      status: statusEndpointReachable,
      socketIO: socketIOEndpointReachable,
      root: rootEndpointReachable,
    },
    networkInfo,
  };

  console.log("Connection diagnostics:", diagnostics);
  return diagnostics;
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
