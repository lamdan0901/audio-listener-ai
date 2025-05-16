// Global state for the extension
let isCurrentlyRecording = false; // Renamed from isRecording to avoid conflict with audio-recorder.js
let lastAudioFile = null; // May need adjustment based on how audio is handled
let isCancelled = false;
let hasLastQuestion = false; // Track if we have a previous question from the backend
let originalQuestion = null; // Store the original question for Gemini processing

// Function to send messages to the background script
function sendMessageToBackground(action, payload, callback) {
  chrome.runtime.sendMessage({ action, payload }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
      if (callback)
        callback({ success: false, error: chrome.runtime.lastError.message });
    } else {
      console.log("Response from background:", response);
      if (callback) callback(response);
    }
  });
}

// Function to update UI elements (placeholders for now)
function updateUI(state) {
  console.log("Updating UI with state:", state);
  // TODO: Implement actual UI updates based on state from background/API
  // e.g., enable/disable buttons, show status, display results
}

// Function to handle responses from the background script
function handleBackgroundResponse(message) {
  if (message && message.action) {
    switch (message.action) {
      case "statusUpdate":
        hasLastQuestion = message.payload.hasLastQuestion;
        isCurrentlyRecording = message.payload.isRecording || false; // Update our local state
        const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
        if (followUpCheckbox) {
          followUpCheckbox.disabled = !hasLastQuestion;
          if (!hasLastQuestion) {
            followUpCheckbox.checked = false; // Uncheck if no last question
          }
          console.log(
            `Follow-up checkbox updated: disabled=${followUpCheckbox.disabled}`
          );
        }
        updateUI({ status: message.payload });
        break;
      case "transcriptionResult":
        // TODO: Handle transcription result display
        console.log("Transcription received:", message.payload);
        updateUI({ transcription: message.payload });
        break;
      case "processingComplete":
        // TODO: Handle processing complete update
        console.log("Processing complete:", message.payload);
        updateUI({ processingResult: message.payload });
        break;
      // Add other cases as needed
      default:
        console.log("Unhandled message from background:", message);
    }
  }
}

// Load saved context and initialize listeners when the popup DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM content loaded, initializing extension...");

  // Check if audio-recorder.js is loaded properly
  if (typeof window.audioRecorder === "undefined") {
    console.error(
      "Audio recorder not available - audio-recorder.js may not be loaded correctly"
    );

    // Show error message to user
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = "Status: Error - Audio recorder not available";
      statusEl.className = "status error";
      statusEl.style.display = "block";
    }

    // Disable the toggle button
    const toggleBtn = document.getElementById("toggleBtn");
    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.title =
        "Audio recorder not available. Please reload the extension.";
    }
  } else {
    console.log("Audio recorder found and ready to use");
  }

  // Restore saved question context from localStorage
  const savedQuestionContext = localStorage.getItem("questionContext");
  if (savedQuestionContext) {
    const contextSelect = document.querySelector(
      'select[name="questionContext"]'
    );
    if (contextSelect) contextSelect.value = savedQuestionContext;
  }

  // Restore saved custom context from localStorage
  const savedCustomContext = localStorage.getItem("customContext");
  if (savedCustomContext) {
    const customContextInput = document.getElementById("customContextInput");
    if (customContextInput) customContextInput.value = savedCustomContext;
  }

  // Add event listener to save context selection
  const contextSelect = document.querySelector(
    'select[name="questionContext"]'
  );
  if (contextSelect) {
    contextSelect.addEventListener("change", function () {
      localStorage.setItem("questionContext", this.value);
    });
  }

  // Add event listener to save custom context
  const customContextInput = document.getElementById("customContextInput");
  if (customContextInput) {
    customContextInput.addEventListener("input", function () {
      localStorage.setItem("customContext", this.value);
    });
  }

  // Initialize follow-up checkbox state - disabled until status is checked
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    followUpCheckbox.disabled = true;
    followUpCheckbox.checked = false;
    followUpCheckbox.addEventListener("change", function () {
      console.log(`Follow-up checkbox toggled: checked=${this.checked}`);
      // TODO: Potentially notify background script or store state if needed
    });
  }

  // Request initial status from the background script
  sendMessageToBackground("getStatus", null, (response) => {
    if (response && response.success) {
      handleBackgroundResponse({
        action: "statusUpdate",
        payload: response.data,
      });
    } else {
      console.error(
        "Failed to get initial status:",
        response ? response.error : "No response"
      );
      // Keep checkbox disabled if status check fails
      if (followUpCheckbox) followUpCheckbox.disabled = true;
    }
  });

  // Set up audio controls if the function is available
  if (typeof setupAudioControls === "function") {
    setupAudioControls();
    console.log("Audio controls set up successfully");
  } else {
    console.error(
      "setupAudioControls function not found - audio-controls.js may not be loaded correctly"
    );
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener(handleBackgroundResponse);

  console.log("Extension main script initialized");
});
