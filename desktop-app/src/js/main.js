// Global state - using window to make these variables accessible across modules
// Initialize global variables only if they don't already exist
if (typeof window.isRecording === "undefined") window.isRecording = false; // Tracks if we're currently recording
if (typeof window.lastAudioFile === "undefined") window.lastAudioFile = null;
if (typeof window.isCancelled === "undefined") window.isCancelled = false;
if (typeof window.hasLastQuestion === "undefined")
  window.hasLastQuestion = false; // Track if we have a previous question
if (typeof window.originalQuestion === "undefined")
  window.originalQuestion = null; // Store the original question for Gemini processing

// Use the global variables directly instead of creating local references

// Animation state variables - using window to make these variables accessible across modules
// Initialize animation state variables only if they don't already exist
if (typeof window.streamedContent === "undefined") window.streamedContent = "";
if (typeof window.previousContent === "undefined") window.previousContent = "";
if (typeof window.animationQueue === "undefined") window.animationQueue = [];
if (typeof window.animationInProgress === "undefined")
  window.animationInProgress = false;

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
window.toggleAlwaysOnTop = toggleAlwaysOnTop;

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
    statusElement.innerHTML = `Connected`;
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

// Function to toggle always on top state
async function toggleAlwaysOnTop() {
  try {
    // Call the main process to toggle the always on top state
    const isAlwaysOnTop = await window.electronAPI.toggleAlwaysOnTop();

    // Update the button appearance
    const alwaysOnTopBtn = document.getElementById("alwaysOnTopBtn");
    const pinText = document.getElementById("pinText");

    if (alwaysOnTopBtn) {
      if (isAlwaysOnTop) {
        alwaysOnTopBtn.classList.add("active");
        if (pinText) pinText.textContent = "Disable Top";
      } else {
        alwaysOnTopBtn.classList.remove("active");
        if (pinText) pinText.textContent = "Keep on Top";
      }
    }

    console.log(`Always on top state: ${isAlwaysOnTop}`);
  } catch (error) {
    console.error("Error toggling always on top:", error);
  }
}

// Load saved question context on page load
document.addEventListener("DOMContentLoaded", function () {
  // Reset animation state on page load
  if (typeof resetAnimationState === "function") {
    resetAnimationState();
  } else {
    // Fallback if the function isn't available
    console.log("resetAnimationState function not available, using fallback");
    window.previousContent = "";
    window.animationInProgress = false;
    window.animationQueue = [];
    window.streamedContent = "";
  }

  // Set up always on top button
  const alwaysOnTopBtn = document.getElementById("alwaysOnTopBtn");
  if (alwaysOnTopBtn) {
    alwaysOnTopBtn.addEventListener("click", toggleAlwaysOnTop);

    // Initialize button state
    window.electronAPI
      .getAlwaysOnTopState()
      .then((isAlwaysOnTop) => {
        if (isAlwaysOnTop) {
          alwaysOnTopBtn.classList.add("active");
          const pinText = document.getElementById("pinText");
          if (pinText) pinText.textContent = "Disable Top";
        }
      })
      .catch((error) => {
        console.error("Error getting always on top state:", error);
      });
  }

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
  try {
    const apiUrl = window.electronAPI.getApiBaseUrl();

    // Function to handle connection attempts with fallbacks
    const attemptConnection = async () => {
      // List of URLs to try in order
      const urls = [
        apiUrl,
        "http://localhost:3033",
        "http://127.0.0.1:3033",
      ].filter(Boolean); // Remove any null/undefined values

      console.log("Will try connecting to these URLs in order:", urls);

      // Try each URL in sequence
      for (const url of urls) {
        try {
          console.log(`Attempting to connect to ${url}...`);
          if (typeof window.socketClient.manualConnect === "function") {
            await window.socketClient.manualConnect(url);
            console.log(`Successfully connected to ${url}`);
            return true; // Connection successful
          } else {
            console.error("socketClient.manualConnect is not a function");
            break;
          }
        } catch (err) {
          console.log(`Failed to connect to ${url}:`, err.message);
          // Continue to next URL
        }
      }

      console.log("All connection attempts failed");
      return false;
    };

    // Start the connection process
    attemptConnection().then((success) => {
      if (success) {
        console.log("Socket.IO connection established successfully");
      } else {
        console.log("Could not establish Socket.IO connection to any endpoint");
        // The app can still function without a Socket.IO connection
        // Just show a message to the user
        const answerElement = document.getElementById("answer");
        if (answerElement) {
          answerElement.innerHTML = `
            <div style="padding: 10px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; margin: 10px 0;">
              <strong>Note:</strong> Could not connect to the server. Some features may be limited.
              <br>
              The app will continue to work, but you may need to restart the server.
            </div>
          `;
        }
      }
    });
  } catch (error) {
    console.error("Error during Socket.IO connection setup:", error);
    // The app can still function without a Socket.IO connection
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
    try {
      const apiUrl = window.electronAPI.getApiBaseUrl(); // Get API URL from preload

      // Skip the API call if we're having issues - this is non-critical functionality
      if (!apiUrl) {
        console.log("API URL not available, skipping session status check");
        return;
      }

      // Add a timeout to the fetch to prevent long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      fetch(`${apiUrl}/api/v1/status`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          return response.json();
        })
        .then((status) => {
          console.log("Server status:", status);
          // If there's a last question, we can enable follow-up questions
          if (status && status.hasLastQuestion) {
            console.log(
              `Previous question found: ${status.lastQuestionPreview}`
            );
            window.hasLastQuestion = true;
            followUpCheckbox.disabled = false;
          } else {
            console.log("No previous questions found");
            window.hasLastQuestion = false;
            followUpCheckbox.disabled = true;
          }
          clearTimeout(timeoutId);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.log(
            "Error checking session status (non-critical):",
            error.message
          );
          // Just continue without the session status - this is non-critical functionality
        });
    } catch (error) {
      console.log(
        "Error in session status check setup (non-critical):",
        error.message
      );
      // Continue without the session status
    }
  }

  console.log("Audio Listener AI Desktop application initialized");

  // Initial button state update
  updateGlobalRecordingButtons();

  // No need for periodic updates - we'll update UI based on state changes instead
});
