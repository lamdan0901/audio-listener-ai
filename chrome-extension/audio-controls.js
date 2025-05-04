// chrome-extension/audio-controls.js

// --- Helper to Send Messages ---
// Ensure this function exists or is imported/defined appropriately
// It should simply send the message and potentially handle basic errors.
function sendMessageToBackground(action, payload, callback) {
  chrome.runtime.sendMessage({ action, payload }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        `Error sending message ${action}:`,
        chrome.runtime.lastError.message
      );
      if (callback)
        callback({ success: false, error: chrome.runtime.lastError.message });
    } else {
      if (callback) callback(response);
    }
  });
}

// --- UI Update Function ---
/**
 * Updates the audio control UI elements based on the provided state.
 * @param {object} state - The current state object from the background script or popup.
 * Expected properties: isRecording (boolean), statusText (string), canRetry (boolean), canGemini (boolean), hasLastQuestion (boolean)
 */
function updateAudioControlUI(state) {
  console.log("updateAudioControlUI called with state:", JSON.stringify(state)); // Log the exact state received
  const toggleBtn = document.getElementById("toggleBtn");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const statusEl = document.getElementById("status"); // The text status element
  const loadingEl = document.getElementById("loading"); // The loading indicator div
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");

  // Determine button states based on background state
  const isProcessing =
    state.statusText?.includes("Processing") ||
    state.statusText?.includes("Retrying") ||
    state.statusText?.includes("Gemini");
  const isIdle =
    !state.isRecording && !isProcessing && state.statusText !== "Recording..."; // Refined idle check
  const canCancel = state.isRecording || isProcessing;

  // Toggle Button (Start/Stop Listening)
  if (toggleBtn) {
    toggleBtn.textContent = state.isRecording
      ? "Stop Listening" // State says recording
      : "Start Listening"; // State says not recording
    toggleBtn.disabled = isProcessing; // Disable toggle if processing/retrying/gemini
    console.log(
      `toggleBtn updated: textContent='${toggleBtn.textContent}', disabled=${toggleBtn.disabled}`
    );
  }

  // Status Display
  if (statusEl) {
    const displayStatus =
      state.statusText || (state.isRecording ? "Recording..." : "Idle");
    statusEl.textContent = `Status: ${displayStatus}`;
    // Update status class for styling (optional)
    if (state.isRecording) statusEl.className = "status recording";
    else if (isProcessing)
      statusEl.className = "status loading"; // Or a specific processing class
    else statusEl.className = "status idle";
    // Hide/show main status text vs loading indicator
    const newStatusDisplay = isProcessing ? "none" : "block";
    statusEl.style.display = newStatusDisplay;
    console.log(
      `statusEl updated: textContent='${statusEl.textContent}', display='${newStatusDisplay}'`
    );
  }

  // Loading Indicator
  if (loadingEl) {
    loadingEl.style.display = isProcessing ? "flex" : "none"; // Use flex for alignment
    // Optionally update loading text
    if (isProcessing) {
      const loadingSpan = loadingEl.querySelector("span");
      if (loadingSpan) loadingSpan.textContent = state.statusText;
    }
    console.log(`loadingEl updated: display='${loadingEl.style.display}'`);
  }

  // Retry Button
  if (retryBtn) {
    // Enable retry only if NOT recording, NOT processing, and backend indicates it's possible (e.g., after an error or completion)
    retryBtn.disabled = state.isRecording || isProcessing || !state.canRetry;
    console.log(`retryBtn updated: disabled=${retryBtn.disabled}`);
  }

  // Gemini Button
  if (geminiBtn) {
    // Enable gemini only if NOT recording, NOT processing, and backend indicates it's possible
    geminiBtn.disabled = state.isRecording || isProcessing || !state.canGemini;
    console.log(`geminiBtn updated: disabled=${geminiBtn.disabled}`);
  }

  // Cancel Button
  if (cancelBtn) {
    cancelBtn.disabled = !canCancel;
    console.log(`cancelBtn updated: disabled=${cancelBtn.disabled}`);
  }

  // Follow-up Checkbox
  if (followUpCheckbox) {
    // Disable if recording, processing, or if there's no last question context
    followUpCheckbox.disabled =
      state.isRecording || isProcessing || !state.hasLastQuestion;
    // Uncheck it if the state indicates completion/cancellation? Or leave as is?
    // Let's leave it checked status as is for now, user manages it when enabled.
    console.log(
      `followUpCheckbox updated: disabled=${followUpCheckbox.disabled}`
    );
  }
}

// --- Action Functions (Send Messages Only) ---

async function toggleRecording() {
  // Get necessary data from UI
  const lang = document.querySelector('input[name="language"]:checked').value;
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  const customContext =
    document.getElementById("customContextInput").value || "";
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Determine action based on *current UI state* (which should reflect background state)
  const toggleBtn = document.getElementById("toggleBtn");
  // Robust check: if button says "Stop Listening", send stop, otherwise start.
  const isCurrentlyRecording = toggleBtn.textContent === "Stop Listening";

  if (!isCurrentlyRecording) {
    // START RECORDING
    console.log("Starting audio recording...");

    // Update UI immediately to show recording state
    updateAudioControlUI({
      isRecording: true,
      statusText: "Recording...",
      canRetry: false,
      canGemini: false,
    });

    // Clear audio files in the audio folder on the server
    try {
      fetch(`http://localhost:3033/api/v1/recording/clear-audio-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Error clearing audio files:", err));
      console.log("Sent request to clear audio files");
    } catch (error) {
      console.error("Failed to send clear audio files request:", error);
      // Continue with recording even if clearing files fails
    }

    // Start recording using the audio-recorder.js
    const recordingStarted = await window.audioRecorder.startRecording();

    if (!recordingStarted) {
      console.error("Failed to start recording");
      // Show error and revert UI
      chrome.runtime.sendMessage({
        action: "error",
        payload: { message: "Failed to access microphone" },
      });
      updateAudioControlUI({
        isRecording: false,
        statusText: "Error",
        canRetry: false,
        canGemini: false,
      });
      return;
    }

    // Notify background script that recording has started (for state tracking)
    sendMessageToBackground("recordingStarted", payload, (response) => {
      if (!(response && response.success)) {
        console.error(
          "Background failed to acknowledge recording start:",
          response?.error
        );
      } else {
        console.log("Background acknowledged recording start");
      }
    });
  } else {
    // STOP RECORDING
    console.log("Stopping audio recording...");

    // Update UI immediately
    updateAudioControlUI({
      isRecording: false,
      statusText: "Processing...",
      canRetry: false,
      canGemini: false,
    });

    try {
      // Stop recording and get the audio blob
      const audioBlob = await window.audioRecorder.stopRecording();

      if (!audioBlob) {
        throw new Error("No audio data captured");
      }

      console.log(
        `Audio recording stopped. Blob size: ${audioBlob.size} bytes`
      );

      // Save the audio blob for retry and Gemini processing
      lastRecordedAudioBlob = audioBlob;

      // Create FormData to send the audio file to the backend
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      // Add other parameters
      formData.append("language", lang);
      formData.append("questionContext", questionContext);
      formData.append("customContext", customContext);
      formData.append("isFollowUp", isFollowUp);

      // Send the audio file to the backend for processing
      const response = await fetch(
        `http://localhost:3033/api/v1/recording/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Audio upload and processing response:", data);

      // Notify background script about the successful upload
      sendMessageToBackground(
        "audioUploaded",
        {
          ...payload,
          success: true,
          data: data,
        },
        (response) => {
          if (!(response && response.success)) {
            console.error(
              "Background failed to acknowledge audio upload:",
              response?.error
            );
          } else {
            console.log("Background acknowledged audio upload");
          }
        }
      );

      // Update UI based on response
      updateAudioControlUI({
        isRecording: false,
        statusText: "Completed",
        canRetry: true,
        canGemini: true,
        hasLastQuestion: true,
      });
    } catch (error) {
      console.error("Error processing audio:", error);

      // Show error
      chrome.runtime.sendMessage({
        action: "error",
        payload: { message: `Failed to process audio: ${error.message}` },
      });

      // Update UI to show error state
      updateAudioControlUI({
        isRecording: false,
        statusText: "Error",
        canRetry: false,
        canGemini: false,
      });
    }
  }

  const payload = {
    language: lang,
    questionContext: questionContext,
    customContext: customContext,
    isFollowUp: isFollowUp,
    duration: 90, // Example duration for start action
  };
}

// Global variable to store the last recorded audio blob
let lastRecordedAudioBlob = null;

async function retryTranscription() {
  console.log("Retrying transcription...");
  const lang = document.querySelector('input[name="language"]:checked').value;
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  const customContext =
    document.getElementById("customContextInput").value || "";
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Update UI immediately
  updateAudioControlUI({
    isRecording: false,
    statusText: "Retrying...",
    canRetry: false,
    canGemini: false,
  });

  try {
    if (!lastRecordedAudioBlob) {
      throw new Error("No audio data available for retry");
    }

    // Create FormData to send the audio file to the backend
    const formData = new FormData();
    formData.append("audio", lastRecordedAudioBlob, "recording.webm");

    // Add other parameters
    formData.append("language", lang);
    formData.append("questionContext", questionContext);
    formData.append("customContext", customContext);
    formData.append("isFollowUp", isFollowUp);

    // Send the audio file to the backend for retry processing
    const response = await fetch(
      `http://localhost:3033/api/v1/recording/retry-upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Retry processing response:", data);

    // Update UI based on response
    updateAudioControlUI({
      isRecording: false,
      statusText: "Completed",
      canRetry: true,
      canGemini: true,
      hasLastQuestion: true,
    });

    // Notify background script about the successful retry
    sendMessageToBackground(
      "retryCompleted",
      {
        language: lang,
        questionContext: questionContext,
        customContext: customContext,
        isFollowUp: isFollowUp,
        success: true,
        data: data,
      },
      (response) => {
        if (!(response && response.success)) {
          console.error(
            "Background failed to acknowledge retry completion:",
            response?.error
          );
        } else {
          console.log("Background acknowledged retry completion");
        }
      }
    );
  } catch (error) {
    console.error("Error retrying transcription:", error);

    // Show error
    chrome.runtime.sendMessage({
      action: "error",
      payload: { message: `Failed to retry: ${error.message}` },
    });

    // Update UI to show error state
    updateAudioControlUI({
      isRecording: false,
      statusText: "Error",
      canRetry: true,
      canGemini: true,
    });
  }
}

async function processWithGemini() {
  console.log("Processing with Gemini...");
  const lang = document.querySelector('input[name="language"]:checked').value;
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  const customContext =
    document.getElementById("customContextInput").value || "";
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Update UI immediately
  updateAudioControlUI({
    isRecording: false,
    statusText: "Processing with Gemini...",
    canRetry: false,
    canGemini: false,
  });

  try {
    if (!lastRecordedAudioBlob) {
      throw new Error("No audio data available for Gemini processing");
    }

    // Create FormData to send the audio file to the backend
    const formData = new FormData();
    formData.append("audio", lastRecordedAudioBlob, "recording.webm");

    // Add other parameters
    formData.append("language", lang);
    formData.append("questionContext", questionContext);
    formData.append("customContext", customContext);
    formData.append("isFollowUp", isFollowUp);

    // Send the audio file to the backend for Gemini processing
    const response = await fetch(
      `http://localhost:3033/api/v1/recording/gemini-upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Gemini processing response:", data);

    // Update UI based on response
    updateAudioControlUI({
      isRecording: false,
      statusText: "Completed",
      canRetry: true,
      canGemini: true,
      hasLastQuestion: true,
    });

    // Notify background script about the successful Gemini processing
    sendMessageToBackground(
      "geminiCompleted",
      {
        language: lang,
        questionContext: questionContext,
        customContext: customContext,
        isFollowUp: isFollowUp,
        success: true,
        data: data,
      },
      (response) => {
        if (!(response && response.success)) {
          console.error(
            "Background failed to acknowledge Gemini completion:",
            response?.error
          );
        } else {
          console.log("Background acknowledged Gemini completion");
        }
      }
    );
  } catch (error) {
    console.error("Error processing with Gemini:", error);

    // Show error
    chrome.runtime.sendMessage({
      action: "error",
      payload: { message: `Failed to process with Gemini: ${error.message}` },
    });

    // Update UI to show error state
    updateAudioControlUI({
      isRecording: false,
      statusText: "Error",
      canRetry: true,
      canGemini: true,
    });
  }
}

function cancelRequest() {
  console.log("Cancelling operation...");

  // First, cancel any active recording
  if (window.audioRecorder && window.audioRecorder.isRecording()) {
    window.audioRecorder.cancelRecording();
  }

  // Update UI immediately
  updateAudioControlUI({
    isRecording: false,
    statusText: "Cancelled",
    canRetry: lastRecordedAudioBlob !== null,
    canGemini: lastRecordedAudioBlob !== null,
  });

  // Notify background script of cancellation
  sendMessageToBackground("cancelOperation", {}, (response) => {
    if (!(response && response.success)) {
      console.error(
        "Background failed to handle cancelOperation:",
        response?.error
      );
    } else {
      console.log("Background acknowledged cancelOperation.");
    }
  });

  // Also notify the popup about the cancellation
  chrome.runtime.sendMessage({
    action: "processingCancelled",
    payload: { message: "Operation cancelled by user" },
  });
}

// --- Setup ---

/**
 * Sets up event listeners for the audio control buttons.
 * Should be called after the DOM is loaded (typically by popup.js).
 */
function setupAudioControls() {
  const toggleBtn = document.getElementById("toggleBtn");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (toggleBtn) toggleBtn.addEventListener("click", toggleRecording);
  if (retryBtn) retryBtn.addEventListener("click", retryTranscription);
  if (geminiBtn) geminiBtn.addEventListener("click", processWithGemini);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelRequest);

  // Initial UI state will be set by popup.js after getting status from background
  console.log("Audio control event listeners attached.");
}

// Note: The global variables like isRecording, hasLastQuestion, etc., are removed
// as the state is now managed by the background script and reflected via updateAudioControlUI.
// The sendMessageToBackground function needs to be defined or imported.
