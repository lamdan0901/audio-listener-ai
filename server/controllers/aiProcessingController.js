const fs = require("fs");
const { processAudioWithGemini } = require("../utils/ai");
const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");
const backendEvents = require("../lib/events");
const { DEFAULT_MODEL_NAME } = require("../lib/ai-client");

/**
 * Process audio directly with Gemini (bypassing Speech-to-Text)
 * @param {string} filePath - Path to audio file
 * @param {string} lang - Language code
 * @param {string} questionContext - Context for the question
 * @param {string} customContext - Custom context information
 * @returns {Promise<Object|null>} - Processing result or null if cancelled
 */
async function processAudioDirectlyWithGemini(
  filePath,
  lang = "en",
  questionContext = "general",
  customContext = "",
  modelName = null,
) {
  console.log(`Processing audio directly with Gemini: ${filePath}`);

  // Check if processing is cancelled before starting
  if (baseController.isProcessingCancelled()) {
    console.log("Processing cancelled, aborting Gemini processing");
    return null;
  }

  const result = await tryCatch(
    processAudioWithGemini(
      filePath,
      lang,
      questionContext,
      customContext,
      modelName,
    ),
  );

  if (result.error) {
    console.error("Error processing audio with Gemini:", result.error.message);
    throw result.error;
  }

  // Check if processing is cancelled after receiving results
  if (baseController.isProcessingCancelled()) {
    console.log("Processing cancelled after Gemini processing");
    return null;
  }

  return {
    transcript:
      result.data.transcript || "Audio processed directly with Gemini",
    answer: result.data.answer,
    audioFile: filePath,
    processedWithGemini: true,
  };
}

// Controller methods
const aiProcessingController = {
  // Process audio file with Gemini Logic
  processAudioFileWithGemini: async (fileToProcess, params) => {
    // Reset retry count when switching to Gemini
    baseController.setRetryCount(0);

    // Inform client we're processing
    backendEvents.emit("processing");

    // Determine if a second model call is needed (when user selected a second model)
    const selectedModel = params.model || DEFAULT_MODEL_NAME;
    const isBackupNeeded =
      typeof params.model2 === "string" && params.model2.trim().length > 0;
    const backupModelName = isBackupNeeded ? params.model2 : null;

    // Fire both model calls concurrently from the start
    const model1Promise = processAudioDirectlyWithGemini(
      fileToProcess,
      params.lang,
      params.questionContext,
      params.customContext,
      params.model,
    );

    // model2Promise is wrapped to always resolve (never reject), preventing
    // an unhandled rejection crash while we await model1Promise below
    const model2Promise = isBackupNeeded
      ? processAudioDirectlyWithGemini(
          fileToProcess,
          params.lang,
          params.questionContext,
          params.customContext,
          backupModelName,
        ).catch((err) => {
          console.error("Error processing audio with backup model:", err);
          return null;
        })
      : null;

    // Wait for model1 and emit its result immediately
    const result = await model1Promise;

    // Add follow-up flag to the result
    if (result && !baseController.isProcessingCancelled()) {
      result.isFollowUp = params.isFollowUp;
    }

    // Handle follow-up logic
    if (!params.isFollowUp && result && result.transcript) {
      baseController.setLastQuestion(result.transcript);
      console.log(
        `Storing new question from Gemini: ${baseController.getLastQuestion()}`,
      );
    }

    // Only continue if we have results and processing wasn't cancelled
    if (result && !baseController.isProcessingCancelled()) {
      // Emit model1 result immediately
      backendEvents.emit("update", {
        ...result,
        selectedModel,
        backupModel: backupModelName,
      });

      // Handle model2 result as it arrives (already in flight)
      if (model2Promise) {
        model2Promise.then((backupResult) => {
          if (backupResult && !baseController.isProcessingCancelled()) {
            backendEvents.emit("backupUpdate", {
              answer: backupResult.answer,
              transcript: backupResult.transcript,
              audioFile: fileToProcess,
              isFollowUp: params.isFollowUp,
              processedWithGemini: true,
            });
          }
        });
      }
    }

    return true;
  },

  // Process audio with Gemini AI directly
  processWithGemini: async (req, res) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);

    // Use the last processed file
    const fileToProcess =
      params.audioFile || baseController.getLastProcessedFile();

    console.log(
      `Gemini processing request received. Processing file: ${fileToProcess}, IsFollowUp: ${
        params.isFollowUp
      }, Current stored question: "${baseController.getLastQuestion()}"`,
    );

    // Reset cancellation flag for new processing task
    baseController.setCancelled(false);

    if (!fileToProcess || !fs.existsSync(fileToProcess)) {
      const errorMsg = "No audio file available for Gemini processing";
      console.error(errorMsg);
      backendEvents.emit("processingError", errorMsg);
      return res.status(400).send(errorMsg);
    }

    const processingResult = await tryCatch(
      aiProcessingController.processAudioFileWithGemini(fileToProcess, params),
    );

    if (processingResult.error) {
      const errorResult = baseController.handleProcessingError(
        processingResult.error,
        params.lang,
        fileToProcess,
      );
      if (!baseController.isProcessingCancelled()) {
        backendEvents.emit("processingError", errorResult.error);
        backendEvents.emit("update", errorResult);
      }
    }

    res.status(200).send("Gemini processing completed");
  },
};

// Export the module
module.exports = {
  processAudioDirectlyWithGemini,
  ...aiProcessingController,
};
