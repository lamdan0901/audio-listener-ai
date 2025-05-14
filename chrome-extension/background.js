// Background service worker for the AI Recording Assistant Extension

// Import the Socket.IO client library
try {
  importScripts("lib/socket.io.min.js"); // Adjust path if needed
} catch (e) {
  console.error("Failed to import Socket.IO client library:", e);
}

console.log("Background service worker started.");

// --- Global State ---
let socket = null; // Socket.IO instance
let isRecording = false;
let lastAudioFile = null; // Placeholder: In a real scenario, this would be managed differently (e.g., storing blob URLs or using file system access)
let hasLastQuestion = false; // Track if the backend has context from a previous question
let currentStatusText = "Idle"; // Add a variable to track the current status text
let lastQuestionPreview = ""; // Store a preview for context
let currentOperationAbortController = null; // To cancel ongoing fetch requests

const API_BASE_URL = "http://localhost:3033"; // Your backend API URL
const SOCKET_URL = "http://localhost:3033"; // Your Socket.IO server URL

// --- Helper Functions ---

// Function to send messages to the popup (if open)
async function sendMessageToPopup(message) {
  // Make async if we need to wait for storage
  console.log(
    `sendMessageToPopup: Attempting to send message:`,
    JSON.stringify(message)
  ); // Log message being sent
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      // Handle error, e.g., popup not open
      console.log(
        `sendMessageToPopup: Error sending message (popup might be closed):`,
        chrome.runtime.lastError.message
      );
    } else {
      // Optional: Handle response from popup
      console.log(
        `sendMessageToPopup: Message sent successfully, response from popup:`,
        response
      );
    }
  });
  // Also update our internal status tracker
  if (message.action === "statusUpdate" && message.payload.statusText) {
    currentStatusText = message.payload.statusText;
    // Persist essential state for when popup reopens (optional but good practice)
    // await chrome.storage.local.set({ backgroundState: { isRecording, currentStatusText } });
  }
}

// Function to safely make fetch requests with cancellation
async function makeApiRequest(endpoint, options = {}, signal) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: signal, // Pass the AbortSignal
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      throw new Error(
        `API Error (${response.status}): ${
          errorData.message || response.statusText
        }`
      );
    }
    // Handle cases where the response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json();
    } else {
      return await response.text(); // Or handle as needed
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Fetch aborted:", endpoint);
      throw error; // Re-throw AbortError to be handled specifically
    }
    console.error(`Error fetching ${endpoint}:`, error);
    throw error; // Re-throw other errors
  }
}

// Function to update the shared state about the last question
function updateLastQuestionState(statusData) {
  if (statusData) {
    hasLastQuestion = statusData.hasLastQuestion || false;
    lastQuestionPreview = statusData.lastQuestionPreview || "";
    console.log(`Background state updated: hasLastQuestion=${hasLastQuestion}`);
    // Notify popup about the status change
    sendMessageToPopup({
      action: "statusUpdate",
      payload: { hasLastQuestion, lastQuestionPreview },
    });
  }
}

// --- Event Listeners ---

// Listen for clicks on the extension's action icon (toolbar icon)
chrome.action.onClicked.addListener(async (tab) => {
  console.log("Extension icon clicked, attempting to open side panel.");
  try {
    // Open the side panel in the current window
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log("Side panel open command issued.");
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated.");
  // Initialize state or perform setup
  makeApiRequest("/api/v1/recording/status")
    .then(updateLastQuestionState)
    .catch((error) => console.error("Initial status check failed:", error));
  // Connect to Socket.IO server
  connectSocketIO();
});

// --- Socket.IO Connection ---
function connectSocketIO() {
  if (socket && socket.connected) {
    console.log("Socket.IO already connected.");
    return;
  }

  // Ensure the library is loaded
  if (typeof io === "undefined") {
    console.error("Socket.IO client library not loaded. Cannot connect.");
    // Optionally retry connection later or notify user
    setTimeout(connectSocketIO, 5000); // Retry after 5 seconds
    return;
  }

  console.log(`Attempting to connect to Socket.IO server at ${SOCKET_URL}`);
  socket = io(SOCKET_URL, {
    // Force WebSocket transport only, bypassing HTTP polling
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Socket.IO connected successfully:", socket.id);
    // You might want to fetch initial status again upon reconnection
    makeApiRequest("/api/v1/recording/status")
      .then(updateLastQuestionState)
      .catch((error) =>
        console.error("Status check failed on socket connect:", error)
      );
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket.IO disconnected:", reason);
    // Handle disconnection, maybe attempt reconnection
    // The client library often handles reconnection automatically, but you can add custom logic
  });

  socket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
    // Handle connection errors
  });

  // --- Socket Event Listeners ---
  // Listen for events from the server and relay them to the popup

  socket.on("error", (errorMessage) => {
    console.error("Received error via Socket.IO:", errorMessage);
    sendMessageToPopup({ action: "error", payload: { message: errorMessage } });
  });

  socket.on("processingCancelled", (data) => {
    console.log("Received processingCancelled via Socket.IO:", data);
    sendMessageToPopup({ action: "processingCancelled", payload: data });
    // Also update background state if needed
    if (currentOperationAbortController) {
      currentOperationAbortController.abort(); // Ensure any related fetch is cancelled
      currentOperationAbortController = null;
    }
    isRecording = false;
    updateLastQuestionState(null); // Reset last question state potentially
  });

  socket.on("processing", () => {
    console.log("Received processing via Socket.IO");
    sendMessageToPopup({
      action: "statusUpdate",
      payload: { statusText: "Processing..." },
    });
  });

  socket.on("transcript", (data) => {
    console.log("Received transcript via Socket.IO:", data);
    sendMessageToPopup({ action: "transcriptUpdate", payload: data });
    // Optionally update background state like lastQuestionPreview
    if (data && data.transcript) {
      lastQuestionPreview =
        data.transcript.substring(0, 50) +
        (data.transcript.length > 50 ? "..." : "");
      sendMessageToPopup({
        action: "statusUpdate",
        payload: { lastQuestionPreview },
      });
    }
  });
  // --- MOVED Socket Event Listeners ---
  socket.on("update", (data) => {
    console.log("Received update via Socket.IO:", data);
    sendMessageToPopup({ action: "answerUpdate", payload: data }); // Assuming 'update' contains partial answers
  });

  socket.on("streamChunk", (data) => {
    // console.log("Received streamChunk via Socket.IO:", data); // Can be noisy
    sendMessageToPopup({ action: "streamChunk", payload: data });
  });

  socket.on("streamEnd", (data) => {
    console.log("Received streamEnd via Socket.IO:", data);
    sendMessageToPopup({ action: "streamEnd", payload: data });
    // Update final state
    updateLastQuestionState(data); // Assuming streamEnd data contains final status
    currentOperationAbortController = null; // Operation finished
  });

  socket.on("streamError", (data) => {
    console.error("Received streamError via Socket.IO:", data);
    sendMessageToPopup({
      action: "error",
      payload: { message: `Streaming Error: ${data}` },
    });
    currentOperationAbortController = null; // Operation finished (with error)
  });
  // --- End MOVED Socket Event Listeners ---
}

// Attempt initial connection when the script loads
// Note: For persistent connections in Manifest V3, managing the connection lifecycle
// (e.g., reconnecting if the service worker becomes inactive) is important.
// The basic client library handles some reconnection, but complex scenarios might need more logic.
connectSocketIO();

// Listener for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("Background received message:", request);

  // Create a new AbortController for operations that can be cancelled
  if (request.action === "cancelOperation") {
    // For cancel operations, we don't need a new controller
    // We'll just use the existing one if any
  } else {
    // For other operations, create a new controller if needed
    // Cancel previous ongoing operation if any
    if (currentOperationAbortController) {
      console.log("Aborting previous operation...");
      currentOperationAbortController.abort();
    }
    currentOperationAbortController = new AbortController();
  }

  switch (request.action) {
    case "recordingStarted":
      // Handle notification that recording has started in the popup
      console.log("Recording started in popup");
      isRecording = true;

      // Update internal state
      currentStatusText = "Recording...";

      // Send success response
      sendResponse({ success: true });
      return false; // No async work

    case "audioUploaded":
      // Handle notification that audio was uploaded from the popup
      console.log("Audio uploaded from popup:", request.payload);

      // Update internal state
      isRecording = false;
      currentStatusText = "Completed";
      lastAudioFile = "popup-recorded-audio"; // Just a marker, not an actual file

      // Update last question state if data is provided
      if (request.payload.data) {
        updateLastQuestionState(request.payload.data);
      }

      // Send success response
      sendResponse({ success: true });
      return false; // No async work

    case "retryCompleted":
      // Handle notification that retry was completed from the popup
      console.log("Retry completed from popup:", request.payload);

      // Update internal state
      currentStatusText = "Completed";

      // Update last question state if data is provided
      if (request.payload.data) {
        updateLastQuestionState(request.payload.data);
      }

      // Send success response
      sendResponse({ success: true });
      return false; // No async work

    case "geminiCompleted":
      // Handle notification that Gemini processing was completed from the popup
      console.log("Gemini processing completed from popup:", request.payload);

      // Update internal state
      currentStatusText = "Completed";

      // Update last question state if data is provided
      if (request.payload.data) {
        updateLastQuestionState(request.payload.data);
      }

      // Send success response
      sendResponse({ success: true });
      return false; // No async work

    case "stopRecording":
      // This case is now handled by the popup directly
      console.log("stopRecording called in background - redirecting to popup");
      sendResponse({
        success: false,
        error: "Recording is now handled by the popup directly",
      });
      return false;

    case "retryTranscription":
      // This case is now handled by the popup directly
      console.log(
        "retryTranscription called in background - redirecting to popup"
      );
      sendResponse({
        success: false,
        error: "Retry is now handled by the popup directly",
      });
      return false;

    case "processWithGemini":
      // This case is now handled by the popup directly
      console.log(
        "processWithGemini called in background - redirecting to popup"
      );
      sendResponse({
        success: false,
        error: "Gemini processing is now handled by the popup directly",
      });
      return false;

    case "cancelOperation":
      console.log("Received cancel request from popup.");

      // Update internal state
      isRecording = false;
      currentStatusText = "Cancelled";

      // Abort any ongoing fetch operations
      if (currentOperationAbortController) {
        currentOperationAbortController.abort();
        currentOperationAbortController = null; // Reset controller
        console.log("Ongoing operation aborted.");
      }

      // Send success response
      sendResponse({ success: true });
      return false;

    case "getStatus":
      // Return the current state known to the background script
      console.log("Popup requested status.");
      const canRetry = !!lastAudioFile; // Enable retry if there's a last audio file
      const canGemini = !!lastAudioFile; // Enable Gemini if there's a last audio file
      const currentInternalStatus = {
        isRecording,
        statusText: currentStatusText,
        canRetry,
        canGemini,
        hasLastQuestion,
        lastQuestionPreview,
      };
      console.log(
        "Sent current internal status to popup:",
        currentInternalStatus
      );
      sendResponse({ success: true, data: currentInternalStatus });
      return false; // No async work

    default:
      console.log("Background received unhandled action:", request.action);
      sendResponse({ success: false, error: "Unhandled action" });
      return false; // No async work
  }
});
