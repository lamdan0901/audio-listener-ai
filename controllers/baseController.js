let isRecording = false;
let currentOutputFile = null;
let lastProcessedFile = null;
let retryCount = 0;
let isProcessingCancelled = false;
let lastQuestion = null; // Store the last question for follow-up context

/**
 * Common functions for request handling
 */

/**
 * Prepares common parameters from request body
 * @param {Object} reqBody - Request body from Express
 * @returns {Object} - Normalized parameters
 */
function prepareRequestParams(reqBody) {
  return {
    lang: reqBody.language === "en" ? "en" : "vi",
    languageCode: reqBody.language === "en" ? "en-US" : "vi-VN",
    speechSpeed: reqBody.speechSpeed || "normal",
    questionContext: reqBody.questionContext || "general",
    customContext: reqBody.customContext || "",
    isFollowUp: reqBody.isFollowUp === true,
    useStreaming: reqBody.useStreaming !== false, // Default to true
    audioFile: reqBody.audioFile || null,
  };
}

/**
 * Handles follow-up questions logic
 * @param {boolean} isFollowUp - Whether this is a follow-up question
 * @param {string} transcript - The current transcript
 * @param {boolean} storeQuestion - Whether to store this question for future follow-ups
 * @returns {string|null} - Previous question for context if this is a follow-up
 */
function handleFollowUpLogic(isFollowUp, transcript, storeQuestion = true) {
  // If this is a follow-up and we don't have a stored question, log a warning
  if (isFollowUp && !lastQuestion) {
    console.log(
      "Follow-up requested but no previous question exists - proceeding but may not have context"
    );
  }

  // If this is a new question (not a follow-up) and we should store it, save for future follow-ups
  if (!isFollowUp && storeQuestion && transcript) {
    lastQuestion = transcript;
    console.log(`Storing new question: ${lastQuestion}`);
  }

  // Return the context question if this is a follow-up
  return isFollowUp ? lastQuestion : null;
}

// Handle the case where no speech was detected
function handleEmptyTranscript(languageCode, audioFile) {
  const apology = languageCode.startsWith("vi")
    ? "Xin lỗi, tôi không nghe rõ. Vui lòng thử lại."
    : "Sorry, I didn't catch that. Please try again.";

  return {
    transcript: "",
    answer: apology,
    audioFile,
  };
}

// Handle errors during processing
function handleProcessingError(err, lang, audioFile) {
  console.error("Processing error:", err);
  const errorMessage = err.message || "An error occurred during processing";

  return {
    error: errorMessage,
    transcript: "",
    answer: lang === "vi" ? `Lỗi: ${errorMessage}` : `Error: ${errorMessage}`,
    audioFile,
  };
}

// Clean up after processing is complete
async function cleanupAfterProcessing(filePath) {
  // We no longer automatically delete the file after processing
  // Instead, store it as the last processed file
  lastProcessedFile = filePath;
  console.log(`Stored audio file reference: ${lastProcessedFile}`);
}

// Get status information
function getStatus() {
  return {
    isRecording,
    currentFile: currentOutputFile,
    lastProcessedFile,
    hasLastQuestion: lastQuestion !== null,
    lastQuestionPreview: lastQuestion
      ? lastQuestion.substring(0, 50) + (lastQuestion.length > 50 ? "..." : "")
      : null,
  };
}

// Cancel ongoing processing
function setCancelled(value = true) {
  isProcessingCancelled = value;
  return isProcessingCancelled;
}

// Export shared state and functions
module.exports = {
  // State getters/setters
  getIsRecording: () => isRecording,
  setIsRecording: (value) => (isRecording = value),
  getCurrentOutputFile: () => currentOutputFile,
  setCurrentOutputFile: (value) => (currentOutputFile = value),
  getLastProcessedFile: () => lastProcessedFile,
  setLastProcessedFile: (value) => (lastProcessedFile = value),
  getRetryCount: () => retryCount,
  setRetryCount: (value) => (retryCount = value),
  incrementRetryCount: () => (retryCount += 1),
  isProcessingCancelled: () => isProcessingCancelled,
  setCancelled,
  getLastQuestion: () => lastQuestion,
  setLastQuestion: (value) => (lastQuestion = value),

  // Utility functions
  prepareRequestParams,
  handleFollowUpLogic,
  handleEmptyTranscript,
  handleProcessingError,
  cleanupAfterProcessing,
  getStatus,
};
