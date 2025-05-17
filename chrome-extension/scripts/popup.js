// chrome-extension/popup.js

// --- Storage Keys ---
const STORAGE_KEY = "popupState";
const LAST_SESSION_KEY = "lastSession"; // New key to track the most recent session

// --- DOM Elements ---
let errorMessageElement;

// Initialize DOM elements when the document is loaded
document.addEventListener("DOMContentLoaded", () => {
  errorMessageElement = document.getElementById("error-message");
});

// --- Helper Functions for Storage ---
async function saveState(newState) {
  try {
    // Add timestamp to track when this state was saved
    const stateWithTimestamp = {
      ...newState,
      timestamp: Date.now(),
    };

    const currentState =
      (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    const updatedState = { ...currentState, ...stateWithTimestamp };

    // Save the updated state
    await chrome.storage.local.set({ [STORAGE_KEY]: updatedState });

    // Also update the last session marker
    await chrome.storage.local.set({ [LAST_SESSION_KEY]: Date.now() });

    console.log("Popup state saved:", updatedState);
  } catch (error) {
    console.error("Error saving popup state:", error);
  }
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY,
      LAST_SESSION_KEY,
    ]);
    const state = result[STORAGE_KEY] || {};
    const lastSession = result[LAST_SESSION_KEY];

    console.log("Popup state loaded:", state);
    console.log("Last session timestamp:", lastSession);

    // If we have state but no last session marker, or the state is very old,
    // it might be stale data from a previous installation
    if (
      state.timestamp &&
      (!lastSession || Date.now() - state.timestamp > 86400000)
    ) {
      console.log("State appears to be stale (>24h old), clearing it");
      await clearState();
      return {};
    }

    return state;
  } catch (error) {
    console.error("Error loading popup state:", error);
    return {}; // Return empty object on error
  }
}

async function clearState() {
  try {
    // Remove both the state and the session marker
    await chrome.storage.local.remove([STORAGE_KEY, LAST_SESSION_KEY]);
    console.log("Popup state and session marker cleared.");
    // Optionally, send message to background to reset its state if needed
    // chrome.runtime.sendMessage({ action: "resetBackgroundState" });
  } catch (error) {
    console.error("Error clearing popup state:", error);
  }
}

// Helper function to request status from background and update UI controls
// Added queue flush request during initialization
async function requestAndUpdateUI() {
  console.log("Requesting status and queued messages...");
  chrome.runtime.sendMessage({ action: "flushQueue" }); // New queue flush

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

// Define elements at a higher scope so they're accessible throughout the file
let answerAreaElement;
let transcriptAreaElement;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup DOM loaded.");

  // --- Get UI Elements ---
  // Moved element getters inside requestAndUpdateUI or ensure they are accessible globally/passed if needed
  transcriptAreaElement = document.getElementById("question"); // Assign to the higher-scoped variable
  answerAreaElement = document.getElementById("answer"); // Assign to the higher-scoped variable
  const scrollToTopBtn = document.getElementById("scroll-to-top");

  if (answerAreaElement) {
    answerAreaElement.textContent = "";
    answerAreaElement.style.display = "block";
  } else {
    console.error("Answer element not found in the DOM during initialization!");
  }

  // --- Scroll to Top Button Functionality ---
  if (scrollToTopBtn) {
    // Show button when user scrolls down 100px from the top
    window.addEventListener("scroll", () => {
      if (
        document.body.scrollTop > 100 ||
        document.documentElement.scrollTop > 100
      ) {
        scrollToTopBtn.classList.add("visible");
      } else {
        scrollToTopBtn.classList.remove("visible");
      }
    });

    // Scroll to top when button is clicked
    scrollToTopBtn.addEventListener("click", () => {
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    });
  } else {
    console.warn("Scroll to top button not found in popup.html");
  }

  // --- Load Initial Text State from Storage ---
  const initialState = await loadState();
  // Don't set statusTextElement here, let requestAndUpdateUI handle it

  // Initialize currentAnswer variable
  let currentAnswer = initialState.answer || ""; // Initialize currentAnswer from storage

  // Handle transcript display
  if (transcriptAreaElement) {
    const transcript = initialState.transcript || "";
    if (transcript) {
      // Add a label to the question element if it's not empty
      if (!transcript.startsWith("Question: ")) {
        transcriptAreaElement.textContent = "Question: " + transcript;
      } else {
        transcriptAreaElement.textContent = transcript;
      }
      transcriptAreaElement.style.display = "block";
    } else {
      transcriptAreaElement.textContent = "";
      transcriptAreaElement.style.display = "none";
    }
  }

  // Handle answer display
  if (answerAreaElement) {
    const answer = initialState.answer || "";
    if (answer) {
      // Check if we have marked library for markdown rendering
      if (typeof marked !== "undefined") {
        try {
          answerAreaElement.innerHTML = marked.parse(answer);
        } catch (e) {
          console.error("Error parsing markdown:", e);
          answerAreaElement.textContent = answer;
        }
      } else {
        answerAreaElement.textContent = answer;
      }

      // Hide the placeholder if we have an answer
      const placeholder = document.getElementById("answer-placeholder");
      if (placeholder) {
        placeholder.style.display = "none";
      }

      answerAreaElement.style.display = "block";
    } else {
      answerAreaElement.textContent = "";

      // Show the placeholder if we don't have an answer
      const placeholder = document.getElementById("answer-placeholder");
      if (placeholder) {
        placeholder.style.display = "block";
      }

      answerAreaElement.style.display = "block";
    }
  }

  // Handle error display
  if (errorMessageElement) {
    errorMessageElement.textContent = initialState.error || "";
    errorMessageElement.style.display = initialState.error ? "block" : "none";
  }

  // --- Initialize Audio Controls (Listeners Only) ---
  if (typeof setupAudioControls === "function") {
    setupAudioControls();
    console.log("Audio control listeners attached by setupAudioControls.");
  } else {
    console.error(
      "setupAudioControls function not found. Ensure audio-controls.js is loaded correctly."
    );
  }

  // --- Message Listener from Background Script ---
  chrome.runtime.onMessage.addListener(
    async (request, _sender, _sendResponse) => {
      // Make listener async - using underscore prefix for unused parameters
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
          console.log("Popup listener: Received statusUpdate message.");
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
              newStatus === "Idle"
            ) {
              // Clear the current answer and UI
              currentAnswer = "";

              // Clear the answer area
              if (answerAreaElement) {
                answerAreaElement.textContent = "";
                // Show the placeholder if it exists
                const placeholder =
                  document.getElementById("answer-placeholder");
                if (placeholder) {
                  placeholder.style.display = "block";
                }
              }

              // Clear the question area
              if (transcriptAreaElement) {
                transcriptAreaElement.textContent = "";
                transcriptAreaElement.style.display = "none";
              }

              // Clear the stored state
              await saveState({ answer: "", transcript: "" });

              // For certain statuses, completely clear the state to ensure fresh start
              if (newStatus === "Idle" || newStatus === "Cancelled") {
                await clearState();
              }
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
            if (newTranscript && !newTranscript.startsWith("Question: ")) {
              newTranscript = `Question: ${newTranscript}`;
            }
            transcriptAreaElement.textContent = newTranscript;
            await saveState({ transcript: newTranscript });
            // Make the question element visible
            transcriptAreaElement.style.display = "block";
          }
          // No UI *controls* update needed usually
          break;

        case "streamChunk":
        case "answerUpdate":
          if (answerAreaElement && request.payload) {
            // Extract the chunk from the payload, checking multiple possible properties
            const chunk =
              typeof request.payload === "string"
                ? request.payload
                : request.payload.text || request.payload.chunk;
            if (chunk) {
              currentAnswer += chunk;
              // Check if we have marked library for markdown rendering
              if (typeof marked !== "undefined") {
                try {
                  answerAreaElement.innerHTML = marked.parse(currentAnswer);
                } catch (e) {
                  console.error("Error parsing markdown:", e);
                  answerAreaElement.textContent = currentAnswer;
                }
              } else {
                answerAreaElement.textContent = currentAnswer;
              }
              answerAreaElement.scrollTop = answerAreaElement.scrollHeight;
              await saveState({ answer: currentAnswer });
              // Make the answer element visible
              answerAreaElement.style.display = "block";
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
          console.log("DEBUGGING: Processing streamEnd event");
          let finalAnswer = currentAnswer;

          const testDirectAnswer = "No answer found";

          // First try with the payload
          if (request.payload) {
            console.log("StreamEnd payload:", request.payload);
            const payloadAnswer =
              typeof request.payload === "string"
                ? request.payload
                : request.payload.fullAnswer || request.payload.finalAnswer;
            console.log("DEBUGGING: Extracted answer:", payloadAnswer);

            if (payloadAnswer) {
              finalAnswer = payloadAnswer;
              currentAnswer = finalAnswer;
            } else {
              console.log(
                "DEBUGGING: No answer found in payload, using test answer"
              );
              finalAnswer = testDirectAnswer;
              currentAnswer = finalAnswer;
            }
          } else {
            console.log(
              "DEBUGGING: No payload in streamEnd event, using test answer"
            );
            finalAnswer = testDirectAnswer;
            currentAnswer = finalAnswer;
          }

          // Use the existing reference to the answer element
          console.log("DEBUGGING: Answer element found:", !!answerAreaElement);

          if (answerAreaElement) {
            console.log("DEBUGGING: Setting answer content");

            // Force the element to be visible first
            answerAreaElement.style.display = "block";
            answerAreaElement.style.visibility = "visible";
            answerAreaElement.style.height = "auto";
            answerAreaElement.style.minHeight = "100px";

            // Check if we have marked library for markdown rendering
            if (typeof marked !== "undefined") {
              try {
                console.log("DEBUGGING: Using marked for rendering");
                answerAreaElement.innerHTML = marked.parse(finalAnswer);
              } catch (e) {
                console.error("Error parsing markdown:", e);
                answerAreaElement.textContent = finalAnswer;
              }
            } else {
              console.log("DEBUGGING: Using plain text rendering");
              answerAreaElement.textContent = finalAnswer;
            }

            answerAreaElement.offsetHeight;
          } else {
            console.error("DEBUGGING: Answer element not found in the DOM!");

            // Create a new answer element if it doesn't exist
            const newAnswerElement = document.createElement("div");
            newAnswerElement.id = "debug-answer";
            newAnswerElement.style.border = "3px solid red";
            newAnswerElement.style.padding = "10px";
            newAnswerElement.style.margin = "10px 0";
            newAnswerElement.style.backgroundColor = "#f9f9f9";

            if (typeof marked !== "undefined") {
              try {
                newAnswerElement.innerHTML = marked.parse(finalAnswer);
              } catch (e) {
                newAnswerElement.textContent = finalAnswer;
              }
            } else {
              newAnswerElement.textContent = finalAnswer;
            }

            document.body.appendChild(newAnswerElement);
            console.log(
              "DEBUGGING: Created new answer element and appended to body"
            );
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
            transcriptAreaElement.textContent = `Question: ${finalData.finalTranscript}`;
            await saveState({
              transcript: `Question: ${finalData.finalTranscript}`,
            });
            // Make the question element visible
            transcriptAreaElement.style.display = "block";
          }
          // Check for both fullAnswer and finalAnswer for compatibility
          const answer = finalData.fullAnswer || finalData.finalAnswer;
          if (answer && answerAreaElement) {
            currentAnswer = answer;
            // Check if we have marked library for markdown rendering
            if (typeof marked !== "undefined") {
              try {
                answerAreaElement.innerHTML = marked.parse(currentAnswer);
              } catch (e) {
                console.error("Error parsing markdown:", e);
                answerAreaElement.textContent = currentAnswer;
              }
            } else {
              answerAreaElement.textContent = currentAnswer;
            }
            await saveState({ answer: currentAnswer });
            // Make the answer element visible
            answerAreaElement.style.display = "block";
            console.log("Answer displayed:", currentAnswer);
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

  // Test connection to background script
  setTimeout(() => {
    const port = chrome.runtime.connect({ name: "popup" });
    port.onDisconnect.addListener(() => {
      console.log("DEBUGGING: Port disconnected from background script");
    });

    // Send a test message to the background script
    chrome.runtime.sendMessage(
      {
        action: "testConnection",
        payload: { message: "Test connection from popup" },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "DEBUGGING: Error connecting to background script:",
            chrome.runtime.lastError
          );
        } else {
          console.log(
            "DEBUGGING: Received response from background script:",
            response
          );
        }
      }
    );
  }, 2000);

  console.log("Popup initialization complete.");
});
