// chrome-extension/popup.js

// --- Storage Key ---
const STORAGE_KEY = "popupState";

// --- Helper Functions for Storage ---
async function saveState(newState) {
  try {
    const currentState =
      (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    const updatedState = { ...currentState, ...newState };
    await chrome.storage.local.set({ [STORAGE_KEY]: updatedState });
    console.log("Popup state saved:", updatedState);
  } catch (error) {
    console.error("Error saving popup state:", error);
  }
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    console.log("Popup state loaded:", result[STORAGE_KEY]);
    return result[STORAGE_KEY] || {}; // Return empty object if nothing is stored
  } catch (error) {
    console.error("Error loading popup state:", error);
    return {}; // Return empty object on error
  }
}

async function clearState() {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    console.log("Popup state cleared.");
    // Optionally, send message to background to reset its state if needed
    // chrome.runtime.sendMessage({ action: "resetBackgroundState" });
  } catch (error) {
    console.error("Error clearing popup state:", error);
  }
}

// Helper function to request status from background and update UI controls
async function requestAndUpdateUI() {
  console.log("Requesting status from background to update UI...");
  const errorMessageElement = document.getElementById("error-message"); // Ensure it's accessible

  chrome.runtime.sendMessage({ action: "getStatus" }, async (response) => {
    let stateFromBackground = {
      isRecording: false,
      statusText: "Idle",
      canRetry: false,
      canGemini: false,
      hasLastQuestion: false,
    };
    if (chrome.runtime.lastError) {
      console.error(
        "Error requesting status for UI update:",
        chrome.runtime.lastError.message
      );
      const errorMsg = `Error connecting: ${chrome.runtime.lastError.message}`;
      if (errorMessageElement) {
        // Check if element exists before using
        errorMessageElement.textContent = errorMsg;
        errorMessageElement.style.display = "block";
      }
      await saveState({ error: errorMsg, statusText: "Error" });
      stateFromBackground.statusText = "Error";
    } else if (response && response.success && response.data) {
      console.log("Status received for UI update:", response.data);
      stateFromBackground = response.data;
      // Save the latest status text from background
      await saveState({ statusText: stateFromBackground.statusText });
      // Clear error message if status is not Error
      if (stateFromBackground.statusText !== "Error" && errorMessageElement) {
        errorMessageElement.textContent = "";
        errorMessageElement.style.display = "none";
        await saveState({ error: "" });
      }
    } else if (response && !response.success) {
      console.error("Failed to get status for UI update:", response.error);
      const errorMsg = `Error getting status: ${response.error}`;
      if (errorMessageElement) {
        errorMessageElement.textContent = errorMsg;
        errorMessageElement.style.display = "block";
      }
      await saveState({ error: errorMsg, statusText: "Error" });
      stateFromBackground.statusText = "Error";
    }

    // Update the Audio Control UI
    if (typeof updateAudioControlUI === "function") {
      updateAudioControlUI(stateFromBackground);
    } else {
      console.error(
        "updateAudioControlUI function not found when updating UI."
      );
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup DOM loaded.");

  // --- Get UI Elements ---
  // Moved element getters inside requestAndUpdateUI or ensure they are accessible globally/passed if needed
  const transcriptAreaElement = document.getElementById("transcript-area");
  const answerAreaElement = document.getElementById("answer-area");
  const errorMessageElement = document.getElementById("error-message");
  const resetButton = document.getElementById("reset-button");

  // --- Load Initial Text State from Storage ---
  const initialState = await loadState();
  // Don't set statusTextElement here, let requestAndUpdateUI handle it
  if (transcriptAreaElement)
    transcriptAreaElement.textContent = initialState.transcript || "";
  if (answerAreaElement)
    answerAreaElement.textContent = initialState.answer || "";
  if (errorMessageElement) {
    errorMessageElement.textContent = initialState.error || "";
    errorMessageElement.style.display = initialState.error ? "block" : "none";
  }
  let currentAnswer = initialState.answer || ""; // Initialize currentAnswer from storage

  // --- Initialize Audio Controls (Listeners Only) ---
  if (typeof setupAudioControls === "function") {
    setupAudioControls();
    console.log("Audio control listeners attached by setupAudioControls.");
  } else {
    console.error(
      "setupAudioControls function not found. Ensure audio-controls.js is loaded correctly."
    );
  }
  // Initial UI state will be set by calling requestAndUpdateUI below.

  // --- Reset Button Listener ---
  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      console.log("Reset button clicked.");
      await clearState(); // Clear local storage

      // Reset text areas
      if (transcriptAreaElement) transcriptAreaElement.textContent = "";
      if (answerAreaElement) answerAreaElement.textContent = "";
      if (errorMessageElement) {
        errorMessageElement.textContent = "";
        errorMessageElement.style.display = "none";
      }
      currentAnswer = "";

      // Send cancel message to background FIRST
      chrome.runtime.sendMessage({ action: "cancelOperation" }, () => {
        // AFTER background confirms (or fails), refresh UI from background state
        requestAndUpdateUI();
        console.log("Cancel operation sent, UI refresh requested.");
      });
    });
  } else {
    console.warn("Reset button not found in popup.html");
  }

  // --- Message Listener from Background Script ---
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      // Make listener async
      console.log("Popup received message:", request);

      // Clear previous errors on new messages unless it's an error message itself
      if (errorMessageElement && request.action !== "error") {
        errorMessageElement.textContent = "";
        errorMessageElement.style.display = "none";
        await saveState({ error: "" }); // Save cleared error state
      }

      let shouldUpdateUI = false; // Flag to check if UI refresh is needed

      switch (request.action) {
        case "statusUpdate":
          +console.log("Popup listener: Received statusUpdate message."); // <-- Add this log
          // Directly update UI based on this status update
          console.log(
            "Received statusUpdate, updating UI directly:",
            request.payload
          );
          if (typeof updateAudioControlUI === "function") {
            // Pass the relevant parts of the payload to the UI updater
            // Assuming updateAudioControlUI expects an object similar to getStatus response
            updateAudioControlUI(request.payload);
          } else {
            console.error(
              "updateAudioControlUI function not found during statusUpdate."
            );
          }
          // Save the status text if provided, but don't trigger a full refresh
          if (request.payload.statusText) {
            await saveState({ statusText: request.payload.statusText });
            // Reset answer/transcript area based on status
            const newStatus = request.payload.statusText;
            if (
              newStatus === "Processing..." ||
              newStatus === "Retrying..." ||
              newStatus === "Processing with Gemini..." ||
              newStatus === "Cancelled" ||
              newStatus === "Idle" ||
              newStatus === "Finished"
            ) {
              currentAnswer = "";
              if (answerAreaElement)
                answerAreaElement.textContent = currentAnswer;
              if (transcriptAreaElement) transcriptAreaElement.textContent = "";
              await saveState({ answer: "", transcript: "" });
            }
          }
          break; // Don't set shouldUpdateUI = true here

        case "error":
          if (request.payload.message) {
            const errorMessage = `Error: ${request.payload.message}`;
            if (errorMessageElement) {
              errorMessageElement.textContent = errorMessage;
              errorMessageElement.style.display = "block";
            }
            await saveState({ error: errorMessage, statusText: "Error" });
          }
          console.log("Received error, will refresh UI.");
          shouldUpdateUI = true;
          break;

        case "transcriptUpdate":
          if (transcriptAreaElement && request.payload.transcript) {
            let newTranscript = request.payload.transcript;
            if (newTranscript && !newTranscript.startsWith("Transcript: ")) {
              newTranscript = `Transcript: ${newTranscript}`;
            }
            transcriptAreaElement.textContent = newTranscript;
            await saveState({ transcript: newTranscript });
          }
          // No UI *controls* update needed usually
          break;

        case "streamChunk":
        case "answerUpdate":
          if (answerAreaElement && request.payload) {
            const chunk =
              typeof request.payload === "string"
                ? request.payload
                : request.payload.text;
            if (chunk) {
              currentAnswer += chunk;
              answerAreaElement.textContent = currentAnswer;
              answerAreaElement.scrollTop = answerAreaElement.scrollHeight;
              await saveState({ answer: currentAnswer });
            }
          }
          // Optionally update status text display slightly, but don't trigger full UI refresh
          const statusTextElement = document.getElementById("status"); // Get status element
          if (
            statusTextElement &&
            statusTextElement.textContent.includes("Processing")
          ) {
            // statusTextElement.textContent = "Status: Receiving answer..."; // Example temporary update
          }
          break;

        case "streamEnd":
          let finalAnswer = currentAnswer;
          if (request.payload) {
            const payloadAnswer =
              typeof request.payload === "string"
                ? request.payload
                : request.payload.finalAnswer;
            if (payloadAnswer) {
              finalAnswer = payloadAnswer;
              currentAnswer = finalAnswer;
              if (answerAreaElement)
                answerAreaElement.textContent = finalAnswer;
            }
          }
          await saveState({ statusText: "Finished", answer: finalAnswer });
          console.log("Stream ended, will refresh UI.");
          shouldUpdateUI = true;
          break;
        case "processingCancelled":
          currentAnswer = "";
          if (answerAreaElement) answerAreaElement.textContent = currentAnswer;
          if (transcriptAreaElement) transcriptAreaElement.textContent = "";
          await saveState({
            statusText: "Cancelled",
            answer: "",
            transcript: "",
          });
          console.log("Processing cancelled, will refresh UI.");
          shouldUpdateUI = true;
          break;

        case "processingComplete":
          console.log("Processing complete message received:", request.payload);
          const finalData = request.payload || {};
          if (finalData.finalTranscript && transcriptAreaElement) {
            transcriptAreaElement.textContent = `Transcript: ${finalData.finalTranscript}`;
            await saveState({
              transcript: `Transcript: ${finalData.finalTranscript}`,
            });
          }
          if (finalData.finalAnswer && answerAreaElement) {
            currentAnswer = finalData.finalAnswer;
            answerAreaElement.textContent = currentAnswer;
            await saveState({ answer: currentAnswer });
          }
          await saveState({ statusText: finalData.statusText || "Completed" });
          console.log("Processing complete, will refresh UI.");
          shouldUpdateUI = true;
          break;

        default:
          console.log("Popup received unhandled action:", request.action);
      }

      // If a state change occurred that requires a full refresh, do it now
      // (statusUpdate now handles its own UI update directly)
      if (shouldUpdateUI && request.action !== "statusUpdate") {
        requestAndUpdateUI();
      }

      return true; // Indicate async listener
    }
  );

  // Request initial status and update UI when popup opens
  requestAndUpdateUI();

  console.log("Popup initialization complete.");
});
