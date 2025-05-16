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
  const loadingEl = document.getElementById("loading-indicator"); // The loading indicator div
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");

  // Determine button states based on background state
  const isProcessing =
    state.statusText?.includes("Processing") ||
    state.statusText?.includes("Retrying") ||
    state.statusText?.includes("Gemini");

  console.log(
    `isProcessing determined as ${isProcessing} based on statusText: '${state.statusText}'`
  );
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
    // When processing, hide the regular status and show the loading indicator instead
    const newStatusDisplay = isProcessing ? "none" : "block";
    statusEl.style.display = newStatusDisplay;
    console.log(
      `statusEl updated: textContent='${statusEl.textContent}', display='${newStatusDisplay}', isProcessing=${isProcessing}`
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
    console.log(
      `loadingEl updated: display='${loadingEl.style.display}', isProcessing=${isProcessing}, statusText='${state.statusText}'`
    );
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
  // Check if audio recorder is available
  if (!window.audioRecorder) {
    console.error(
      "Audio recorder not found - ensure audio-recorder.js is loaded first"
    );
    chrome.runtime.sendMessage({
      action: "error",
      payload: {
        message: "Audio recorder not available. Please reload the extension.",
      },
    });
    updateAudioControlUI({
      isRecording: false,
      statusText: "Error: Audio recorder not available",
      canRetry: false,
      canGemini: false,
    });
    return;
  }

  // Get necessary data from UI
  const lang = document.querySelector('input[name="language"]:checked').value;
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  const customContext =
    document.getElementById("customContextInput").value || "";
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Create payload object early so it's available for both branches
  const payload = {
    language: lang,
    questionContext: questionContext,
    customContext: customContext,
    isFollowUp: isFollowUp,
    duration: 90, // Example duration for start action
  };

  // Determine action based on *current UI state* (which should reflect background state)
  const toggleBtn = document.getElementById("toggleBtn");
  // Robust check: if button says "Stop Listening", send stop, otherwise start.
  const isCurrentlyRecording = toggleBtn.textContent === "Stop Listening";

  if (!isCurrentlyRecording) {
    // START RECORDING
    console.log("Starting audio recording...");

    // Clear previous question and answer from UI
    const questionElement = document.getElementById("question");
    const answerElement = document.getElementById("answer");

    if (questionElement) {
      questionElement.textContent = "";
      questionElement.style.display = "none";
    }

    if (answerElement) {
      answerElement.textContent = "";
      // Check if there's a placeholder and make it visible
      const placeholder = document.getElementById("answer-placeholder");
      if (placeholder) {
        placeholder.style.display = "block";
      }
      // Keep the answer element visible but empty
      answerElement.style.display = "block";
    }

    // Clear state in storage
    if (typeof clearState === "function") {
      clearState().catch((err) => console.error("Error clearing state:", err));
    } else {
      console.warn("clearState function not available");
      // Fallback: try to clear state directly
      try {
        chrome.storage.local.remove("popupState");
      } catch (err) {
        console.error("Error directly clearing state:", err);
      }
    }

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

    try {
      // First request tab capture permission explicitly
      const permissionGranted =
        await window.audioRecorder.requestTabCapturePermission();

      if (!permissionGranted) {
        // Get specific permission status
        const permStatus = window.audioRecorder.getPermissionStatus();
        let errorMessage = "Failed to access tab audio";

        if (permStatus === "denied") {
          errorMessage =
            "Tab audio access was denied. Please allow tab capture in your browser settings.";
        } else if (permStatus === "dismissed") {
          errorMessage =
            "Tab audio permission request was dismissed. Please try again and allow tab capture.";
        }

        console.error(`Permission error: ${permStatus}`);

        // Show error and revert UI
        chrome.runtime.sendMessage({
          action: "error",
          payload: { message: errorMessage },
        });

        // Show permission instructions in the UI
        showPermissionInstructions(permStatus);

        updateAudioControlUI({
          isRecording: false,
          statusText: `Error: ${permStatus}`,
          canRetry: true,
          canGemini: false,
        });
        return;
      }

      // Clear any permission instructions since permission was granted
      const permInstructionsEl = document.getElementById(
        "permission-instructions"
      );
      if (permInstructionsEl) {
        permInstructionsEl.style.display = "none";
      }

      // Now start recording
      const recordingStarted = await window.audioRecorder.startRecording();

      if (!recordingStarted) {
        console.error("Failed to start recording");
        // Show error and revert UI
        chrome.runtime.sendMessage({
          action: "error",
          payload: {
            message: "Failed to start recording after permission was granted",
          },
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
    } catch (error) {
      console.error("Error starting recording:", error);
      chrome.runtime.sendMessage({
        action: "error",
        payload: { message: `Failed to start recording: ${error.message}` },
      });
      updateAudioControlUI({
        isRecording: false,
        statusText: "Error",
        canRetry: false,
        canGemini: false,
      });
    }
  } else {
    // STOP RECORDING
    console.log("Stopping audio recording...");

    // Update UI immediately to show processing state
    updateAudioControlUI({
      isRecording: false,
      statusText: "Processing...",
      canRetry: false,
      canGemini: false,
    });

    // Explicitly show loading indicator and hide status
    const statusEl = document.getElementById("status");
    const loadingEl = document.getElementById("loading-indicator");
    if (statusEl) statusEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "flex";

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

      // Extract transcript and answer from response data
      if (data && data.transcript) {
        console.log("Received transcript from server:", data.transcript);
        // Update question element directly
        const questionElement = document.getElementById("question");
        if (questionElement) {
          questionElement.textContent = `Question: ${data.transcript}`;
          questionElement.style.display = "block";
          console.log("Updated question element with transcript");
        } else {
          console.error("Question element not found in DOM");
        }
      }

      // Added null check and error handling for markdown parsing
      if (data && data.fullAnswer) {
        console.log("Received answer from server:", data.fullAnswer);
        const answerElement = document.getElementById("answer");
        if (answerElement) {
          try {
            answerElement.innerHTML = marked.parse(data.fullAnswer || "");
          } catch (e) {
            answerElement.textContent = "Error formatting answer";
          }
          answerElement.style.display = "block";
        }
      }

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

      // Explicitly hide loading indicator and show status
      const statusEl = document.getElementById("status");
      const loadingEl = document.getElementById("loading-indicator");
      if (statusEl) statusEl.style.display = "block";
      if (loadingEl) loadingEl.style.display = "none";
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

      // Explicitly hide loading indicator and show status
      const statusEl = document.getElementById("status");
      const loadingEl = document.getElementById("loading-indicator");
      if (statusEl) statusEl.style.display = "block";
      if (loadingEl) loadingEl.style.display = "none";
    }
  }
}

// Global variable to store the last recorded audio blob
let lastRecordedAudioBlob = null;

/**
 * Shows permission instructions in the UI based on the permission status
 * @param {string} permissionStatus - The current permission status ('denied', 'dismissed', etc.)
 */
function showPermissionInstructions(permissionStatus) {
  // Get or create the permission instructions element
  let permInstructionsEl = document.getElementById("permission-instructions");

  if (!permInstructionsEl) {
    // Create the element if it doesn't exist
    permInstructionsEl = document.createElement("div");
    permInstructionsEl.id = "permission-instructions";
    permInstructionsEl.className = "permission-instructions";

    // Insert after the status element
    const statusEl = document.getElementById("status");
    if (statusEl && statusEl.parentNode) {
      statusEl.parentNode.insertBefore(
        permInstructionsEl,
        statusEl.nextSibling
      );
    } else {
      // Fallback - add to the body
      document.body.appendChild(permInstructionsEl);
    }
  }

  // Set the content based on permission status
  if (permissionStatus === "denied") {
    permInstructionsEl.innerHTML = `
      <h3>Tab Audio Access Denied</h3>
      <p>You've denied tab audio access. To use the recording feature, please follow these steps:</p>
      <ol>
        <li>Click the lock/site settings icon in the address bar</li>
        <li>Find "Tab Capture" in the permissions list</li>
        <li>Change it from "Block" to "Allow"</li>
        <li>Refresh this page</li>
      </ol>
      <button id="openSettingsBtn" class="permission-button">Open Chrome Settings</button>
      <div class="permission-image">
        <img src="images/chrome-permission-help.svg" alt="Chrome permission settings" />
      </div>
    `;
  } else if (permissionStatus === "dismissed") {
    permInstructionsEl.innerHTML = `
      <h3>Chrome Extension Tab Capture Permission Required</h3>
      <p>This Chrome extension needs permission to capture tab audio.</p>
      <p>Since this is a Chrome extension, you need to grant permission in a specific way:</p>
      <ol>
        <li>Click the extension icon in the Chrome toolbar</li>
        <li>Click the three dots (⋮) menu for this extension</li>
        <li>Select "Manage extension"</li>
        <li>Find and enable the "Site access" toggle for this extension</li>
        <li>Under "Permissions", make sure "Tab Capture" is enabled</li>
        <li>You may need to restart Chrome after enabling permissions</li>
        <li>Return to this popup and click "Start Listening" again</li>
      </ol>
      <p><strong>Note:</strong> If you're still having issues, try clicking the button below to open extension settings directly.</p>
      <button id="openExtensionSettingsBtn" class="permission-button">Open Extension Settings</button>
      <div class="permission-image">
        <img src="images/chrome-permission-prompt.svg" alt="Chrome permission prompt" />
      </div>
    `;
  } else {
    permInstructionsEl.innerHTML = `
      <h3>Tab Audio Access Issue</h3>
      <p>There was a problem capturing tab audio. Please ensure tab capture is enabled and working properly.</p>
    `;
  }

  // Show the instructions
  permInstructionsEl.style.display = "block";

  // Set up button handlers after a short delay to ensure the DOM is updated
  setTimeout(setupPermissionButtonHandlers, 100);
}

/**
 * Sets up event handlers for permission-related buttons
 */
function setupPermissionButtonHandlers() {
  // Handler for the "Open Extension Settings" button
  const openExtensionSettingsBtn = document.getElementById(
    "openExtensionSettingsBtn"
  );
  if (openExtensionSettingsBtn) {
    // Remove any existing listeners to avoid duplicates
    openExtensionSettingsBtn.replaceWith(
      openExtensionSettingsBtn.cloneNode(true)
    );

    // Get the fresh button reference
    const newExtensionSettingsBtn = document.getElementById(
      "openExtensionSettingsBtn"
    );
    if (newExtensionSettingsBtn) {
      newExtensionSettingsBtn.addEventListener("click", function () {
        console.log("Open extension settings button clicked");
        try {
          // First try to open the extension permissions page directly
          chrome.tabs.create({
            url: "chrome://extensions/?id=" + chrome.runtime.id,
          });

          // Show a notification to guide the user
          const notificationEl = document.createElement("div");
          notificationEl.className = "permission-notification";
          notificationEl.innerHTML = `
            <p>Extension settings page opened in a new tab. Please:</p>
            <ol>
              <li>Enable the extension if it's not enabled</li>
              <li>Click on "Details" for this extension</li>
              <li>Scroll down to "Site access" and select "On all sites"</li>
              <li>Make sure "Tab Capture" permission is enabled</li>
              <li>Restart Chrome after making changes</li>
            </ol>
          `;

          // Add the notification to the page
          const permInstructionsEl = document.getElementById(
            "permission-instructions"
          );
          if (permInstructionsEl) {
            permInstructionsEl.appendChild(notificationEl);
          } else {
            document.body.appendChild(notificationEl);
          }

          // Auto-remove the notification after 30 seconds
          setTimeout(() => {
            if (notificationEl.parentNode) {
              notificationEl.parentNode.removeChild(notificationEl);
            }
          }, 30000);
        } catch (error) {
          console.error("Error opening extension settings:", error);
          // Fallback to the general extensions page
          chrome.tabs.create({
            url: "chrome://extensions",
          });
        }
      });
      console.log("Added click handler to open extension settings button");
    }
  }

  // Handler for the "Open Chrome Settings" button
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  if (openSettingsBtn) {
    // Remove any existing listeners to avoid duplicates
    openSettingsBtn.replaceWith(openSettingsBtn.cloneNode(true));

    // Get the fresh button reference
    const newSettingsBtn = document.getElementById("openSettingsBtn");
    if (newSettingsBtn) {
      newSettingsBtn.addEventListener("click", function () {
        console.log("Open settings button clicked");
        try {
          // Open Chrome's site settings for this extension
          chrome.tabs.create({
            url:
              "chrome://settings/content/siteDetails?site=" +
              encodeURIComponent(chrome.runtime.getURL("")),
          });
        } catch (error) {
          console.error("Error opening Chrome settings:", error);
          // Fallback to a more general settings page
          chrome.tabs.create({
            url: "chrome://settings/content/tabCapture",
          });
        }
      });
      console.log("Added click handler to open settings button");
    }
  }
}

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

  try {
    // First, cancel any active recording if audio recorder is available
    if (
      window.audioRecorder &&
      typeof window.audioRecorder.isRecording === "function"
    ) {
      if (window.audioRecorder.isRecording()) {
        window.audioRecorder.cancelRecording();
      }
    } else {
      console.warn("Audio recorder not available for cancellation");
    }
  } catch (error) {
    console.error("Error cancelling recording:", error);
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

  // Check if audio recorder is available
  if (!window.audioRecorder) {
    console.warn(
      "Audio recorder not found during setup - ensure audio-recorder.js is loaded first"
    );

    // We'll still attach event listeners, but the toggleRecording function will handle the error
    if (toggleBtn) {
      toggleBtn.title =
        "Audio recorder not available. Please reload the extension.";
    }
  } else {
    console.log("Audio recorder found and ready");
    if (toggleBtn) {
      toggleBtn.title = "Click to start/stop audio recording";
    }
  }

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
