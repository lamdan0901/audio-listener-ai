let isRecording = false;
let currentOutputFile = null;
let lastProcessedFile = null;
let retryCount = 0;
let isProcessingCancelled = false;
let lastQuestion = null;

/**
 * Common functions for request handling
 */

/**
 * Prepares common parameters from request body
 * @param {Object} reqBody - Request body
 * @returns {Object} - Normalized parameters
 */
function prepareRequestParams(reqBody) {
  return {
    lang: reqBody.language, // "en" or "vi"
    languageCode: reqBody.language, // "en" or "vi"
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
  console.log("Handling empty transcript for audio file:", audioFile);

  // More detailed response with troubleshooting suggestions
  const apology =
    languageCode === "vi"
      ? "Xin lỗi, tôi không nghe rõ. Vui lòng thử lại và đảm bảo rằng:\n\n" +
        "1. Microphone của bạn đang hoạt động\n" +
        "2. Bạn đang nói đủ to\n" +
        "3. Không có tiếng ồn xung quanh\n\n" +
        "Bạn cũng có thể thử chọn một thiết bị microphone khác nếu có sẵn."
      : "Sorry, I didn't catch that. Please try again and make sure that:\n\n" +
        "1. Your microphone is working properly\n" +
        "2. You're speaking loud enough\n" +
        "3. There isn't too much background noise\n\n" +
        "You can also try selecting a different microphone device if available.";

  // Log the empty transcript event for debugging
  console.log("Empty transcript detected, returning apology message");

  return {
    transcript: "",
    answer: apology,
    audioFile,
    emptyTranscript: true, // Flag to indicate this was an empty transcript
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
