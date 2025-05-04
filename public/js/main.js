// Initialize socket connection
const socket = io();

// Global state
let isRecording = false;
let lastAudioFile = null;
let isCancelled = false;
let hasLastQuestion = false; // Track if we have a previous question
let originalQuestion = null; // Store the original question for Gemini processing

// Load saved question context on page load
document.addEventListener("DOMContentLoaded", function () {
  // Reset animation state on page load
  resetAnimationState();

  // Initialize socket event handlers
  initSocketHandlers(socket);

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
    fetch("/status") // Corrected endpoint
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
      });
  }

  console.log("Audio Listener AI application initialized");
});
