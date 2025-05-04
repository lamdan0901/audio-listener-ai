// Global state - using window to make these variables accessible across modules
window.isRecording = false; // Tracks if we're currently recording
window.lastAudioFile = null;
window.isCancelled = false;
window.hasLastQuestion = false; // Track if we have a previous question
window.originalQuestion = null; // Store the original question for Gemini processing

// Local references for convenience
let isRecording = window.isRecording;
let lastAudioFile = window.lastAudioFile;
let isCancelled = window.isCancelled;
let hasLastQuestion = window.hasLastQuestion;
let originalQuestion = window.originalQuestion;

// Animation state variables - using window to make these variables accessible across modules
window.streamedContent = "";
window.previousContent = "";
window.animationQueue = [];
window.animationInProgress = false;

// Local references for convenience
let streamedContent = window.streamedContent;
let previousContent = window.previousContent;
let animationQueue = window.animationQueue;
let animationInProgress = window.animationInProgress;

// Function to update recording button states
function updateGlobalRecordingButtons() {
  if (typeof window.audioRecorder === "undefined") {
    console.error("Audio recorder not initialized");
    return;
  }

  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const toggleBtn = document.getElementById("toggleBtn");
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");

  if (!toggleBtn) {
    console.error("Toggle button not found");
    return;
  }

  const actuallyRecording = window.audioRecorder.isRecording();
  window.isRecording = actuallyRecording; // Keep global state in sync

  // Update button states
  toggleBtn.textContent = actuallyRecording
    ? "Stop Listening"
    : "Start Listening";
  toggleBtn.disabled = false; // Always enable the toggle button unless explicitly disabled elsewhere

  // Update other button states
  if (retryBtn)
    retryBtn.disabled = actuallyRecording || !window.lastRecordedAudioBlob;
  if (geminiBtn)
    geminiBtn.disabled = actuallyRecording || !window.lastRecordedAudioBlob;
  if (cancelBtn) cancelBtn.disabled = !actuallyRecording;

  // Update follow-up checkbox state
  if (followUpCheckbox) {
    followUpCheckbox.disabled = actuallyRecording || !window.hasLastQuestion;
    console.log(
      `Follow-up checkbox state: disabled=${followUpCheckbox.disabled}, hasLastQuestion=${window.hasLastQuestion}`
    );
  }
}

// Expose the function to the window object
window.updateGlobalRecordingButtons = updateGlobalRecordingButtons;

// Function to toggle recording
async function toggleRecording() {
  // Check if audio-controls.js is loaded
  if (
    typeof window.audioControls !== "undefined" &&
    typeof window.audioControls.toggleRecording === "function"
  ) {
    await window.audioControls.toggleRecording();
    // Update button states after toggling
    updateGlobalRecordingButtons();
  } else {
    console.error("Audio controls not loaded properly");
  }
}

// Expose functions to the global scope
window.toggleRecording = toggleRecording;

// Function to update connection status display
function updateConnectionStatus() {
  if (!window.socketClient) return;

  const status = window.socketClient.getConnectionStatus();
  const statusElement = document.createElement("div");
  statusElement.id = "connection-status";
  statusElement.style.cssText =
    "position: fixed; top: 10px; right: 10px; padding: 5px 10px; border-radius: 3px; font-size: 12px; z-index: 9999;";

  if (status.connected) {
    statusElement.style.backgroundColor = "#4CAF50";
    statusElement.style.color = "white";
    statusElement.innerHTML = `Connected (${status.transport})`;
  } else {
    statusElement.style.backgroundColor = "#F44336";
    statusElement.style.color = "white";
    statusElement.innerHTML = "Disconnected";
  }

  // Remove existing status element if it exists
  const existingStatus = document.getElementById("connection-status");
  if (existingStatus) {
    existingStatus.remove();
  }

  document.body.appendChild(statusElement);

  // Schedule next update
  setTimeout(updateConnectionStatus, 2000);
}

// Load saved question context on page load
document.addEventListener("DOMContentLoaded", function () {
  // Reset animation state on page load
  resetAnimationState();

  // Start connection status updates
  updateConnectionStatus();

  // Restore saved question context from localStorage if available
  const savedQuestionContext = localStorage.getItem("questionContext");
  if (savedQuestionContext) {
    const contextSelect = document.querySelector(
      'select[name="questionContext"]'
    );
    if (contextSelect) {
      contextSelect.value = savedQuestionContext;
    }
  }

  // Initialize Socket.IO connection with fallbacks
  const apiUrl = window.electronAPI.getApiBaseUrl();

  if (apiUrl) {
    console.log(`Initializing Socket.IO connection to ${apiUrl}`);
    window.socketClient
      .initializeSocket(apiUrl)
      .then(() => {
        console.log("Socket.IO connection established successfully");
      })
      .catch((error) => {
        console.error("Failed to establish Socket.IO connection:", error);

        // Try fallback URLs if the main one fails
        console.log("Trying fallback connection to http://localhost:3033");
        setTimeout(() => {
          window.socketClient
            .manualConnect("http://localhost:3033")
            .then(() => {
              console.log("Fallback connection successful");
            })
            .catch((fallbackError) => {
              console.error("Fallback connection failed:", fallbackError);

              // Try one more fallback
              console.log("Trying second fallback to http://127.0.0.1:3033");
              setTimeout(() => {
                window.socketClient.manualConnect("http://127.0.0.1:3033");
              }, 1000);
            });
        }, 1000);
      });
  } else {
    console.error("API URL not available. Trying default connection.");

    // Try default connection
    window.socketClient.manualConnect("http://localhost:3033").catch(() => {
      // If that fails, try with IP
      window.socketClient.manualConnect("http://127.0.0.1:3033");
    });
  }

  // Load saved custom context from localStorage if available
  const savedCustomContext = localStorage.getItem("customContext");
  if (savedCustomContext) {
    const customContextInput = document.getElementById("customContextInput");
    if (customContextInput) {
      customContextInput.value = savedCustomContext;
    }
  }

  // Add event listener to save selection to localStorage when changed
  const contextSelect = document.querySelector(
    'select[name="questionContext"]'
  );
  if (contextSelect) {
    contextSelect.addEventListener("change", function () {
      localStorage.setItem("questionContext", this.value);
    });
  }

  // Add event listener to save custom context to localStorage when it changes
  const customContextInput = document.getElementById("customContextInput");
  if (customContextInput) {
    customContextInput.addEventListener("input", function () {
      localStorage.setItem("customContext", this.value);
    });
  }

  // Add event listener for history date select
  const historyDateSelect = document.getElementById("historyDateSelect");
  if (historyDateSelect) {
    historyDateSelect.addEventListener("change", onHistoryDateChange);
  }

  // Initialize follow-up checkbox state - always disabled on page load
  // unless we already have a previous session with questions
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    // Start with the checkbox disabled
    followUpCheckbox.disabled = true;
    followUpCheckbox.checked = false;

    // Add event listener to log when checkbox is toggled
    followUpCheckbox.addEventListener("change", function () {
      console.log(`Follow-up checkbox toggled: checked=${this.checked}`);
    });

    // Check if we have a previous session with questions
    // We'll request the current status from the server
    const apiUrl = window.electronAPI.getApiBaseUrl(); // Get API URL from preload
    // NOTE: This assumes the API server is running and accessible at this endpoint
    fetch(`${apiUrl}/api/v1/status`) // Use full URL
      .then((response) => response.json())
      .then((status) => {
        console.log("Server status:", status);
        // If there's a last question, we can enable follow-up questions
        if (status.hasLastQuestion) {
          console.log(`Previous question found: ${status.lastQuestionPreview}`);
          hasLastQuestion = true;
          followUpCheckbox.disabled = false;
        } else {
          console.log("No previous questions found");
          hasLastQuestion = false;
          followUpCheckbox.disabled = true;
        }
      })
      .catch((error) => {
        console.error("Error checking session status:", error);
        // Handle error appropriately in Electron context (e.g., show message)
      });
  }

  console.log("Audio Listener AI Desktop application initialized");

  // Initial button state update
  updateGlobalRecordingButtons();

  // Set up periodic updates to keep UI in sync
  setInterval(updateGlobalRecordingButtons, 1000);
});
