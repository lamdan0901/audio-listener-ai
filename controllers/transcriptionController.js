const fs = require("fs");
const { transcribeAudio } = require("../utils/ai");
const baseController = require("./baseController");
const fileController = require("./fileController");
const { tryCatch } = require("../lib/tryCatch");

/**
 * Processes audio transcription with error handling
 * @param {Object} io - Socket.io instance
 * @param {string} fileToProcess - Audio file path
 * @param {Object} params - Processing parameters
 * @param {Object} transcriptionOptions - Options for transcription
 * @returns {Promise<string|null>} - Transcription result or null if error/cancelled
 */
async function processTranscription(
  io,
  fileToProcess,
  params,
  transcriptionOptions
) {
  const result = await tryCatch(
    transcribeAudio(fileToProcess, params.languageCode, transcriptionOptions)
  );

  if (result.error) {
    console.error(
      "Transcription error during processing:",
      result.error.message
    );
    const errorResult = baseController.handleProcessingError(
      result.error,
      params.lang,
      fileToProcess
    );
    if (!baseController.isProcessingCancelled()) {
      io.emit("error", errorResult.error);
      io.emit("update", errorResult);
    }
    return null;
  }

  return result.data;
}

const transcriptionController = {
  // Stop recording and process the audio
  stopRecording: async (req, res, io) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);

    console.log(
      `Stop recording request received. Language: ${params.lang}, Context: ${
        params.questionContext
      }, Custom Context: ${
        params.customContext ? "provided" : "none"
      }, IsFollowUp: ${
        params.isFollowUp
      }, Current stored question: "${baseController.getLastQuestion()}"`
    );

    // Reset cancellation flag for new processing task
    baseController.setCancelled(false);

    // If not currently recording, inform client and return
    if (!baseController.getIsRecording()) {
      const errorMsg = "No active recording to stop";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    // Store output file path before stopping the process
    const fileToProcess = baseController.getCurrentOutputFile();

    const processingResult = await tryCatch(
      (async () => {
        // Get reference to the recording controller to stop the recording
        const recordingController = require("./recordingController");

        // Stop FFmpeg process first
        await recordingController.stopRecordingProcess();

        // Inform client that we're processing the recording
        io.emit("processing");

        // Make sure the file has been written and contains data
        await fileController.validateAudioFile(fileToProcess);

        // Reset retry count for new recording
        baseController.setRetryCount(0);

        // Process the audio to text with appropriate options
        const transcriptionOptions = {
          questionContext: params.questionContext,
          customContext: params.customContext,
          isFollowUp: params.isFollowUp,
        };

        // Only update the last processed file if we have a valid file
        baseController.setLastProcessedFile(fileToProcess);

        // Get the transcript first - we'll return early if cancelled
        const transcriptionResult = await processTranscription(
          io,
          fileToProcess,
          params,
          transcriptionOptions
        );

        // If transcription failed or was cancelled, exit early
        if (transcriptionResult === null) {
          return false;
        }

        // Get reference to the AI processing controller
        const aiProcessingController = require("./aiProcessingController");

        // Handle the transcription result
        await aiProcessingController.handleTranscriptionResult(
          io,
          transcriptionResult,
          params,
          fileToProcess
        );

        return true;
      })()
    );

    if (processingResult.error) {
      const errorResult = baseController.handleProcessingError(
        processingResult.error,
        params.lang,
        fileToProcess
      );
      if (!baseController.isProcessingCancelled()) {
        io.emit("error", errorResult.error);
        io.emit("update", errorResult);
      }
    }

    // Don't delete the file after processing - we store it for possible retry
    await baseController.cleanupAfterProcessing(fileToProcess);

    res.status(200).send("Recording stopped");
  },

  // Retry transcription with different settings
  retryTranscription: async (req, res, io) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);

    // Allow specifying a specific audio file to process or use the last processed file
    const fileToProcess =
      params.audioFile || baseController.getLastProcessedFile();

    console.log(
      `Retry request received. Processing file: ${fileToProcess}, Retry count: ${baseController.getRetryCount()}, IsFollowUp: ${
        params.isFollowUp
      }, Current stored question: "${baseController.getLastQuestion()}"`
    );

    // Reset cancellation flag for new processing task
    baseController.setCancelled(false);

    if (!fileToProcess || !fs.existsSync(fileToProcess)) {
      const errorMsg = "No audio file available for retry";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    const processingResult = await tryCatch(
      (async () => {
        io.emit("processing");

        // Increment retry count for this file to try different models
        baseController.incrementRetryCount();
        const retryCount = baseController.getRetryCount();

        // Use different transcription strategies based on retry count
        const transcriptionOptions = {
          questionContext: params.questionContext,
          retryAttempt: true, // Flag this as a retry attempt
          attemptNumber: retryCount,
          isFollowUp: params.isFollowUp,
        };

        console.log(`Using retry strategy #${retryCount % 3}`);

        // Get the transcript first
        const transcriptionResult = await processTranscription(
          io,
          fileToProcess,
          params,
          transcriptionOptions
        );

        // If transcription failed or was cancelled, exit early
        if (transcriptionResult === null) {
          return false;
        }

        // Get reference to the AI processing controller
        const aiProcessingController = require("./aiProcessingController");

        // Handle the transcription result
        await aiProcessingController.handleTranscriptionResult(
          io,
          transcriptionResult,
          params,
          fileToProcess
        );

        return true;
      })()
    );

    if (processingResult.error) {
      const errorResult = baseController.handleProcessingError(
        processingResult.error,
        params.lang,
        fileToProcess
      );
      if (!baseController.isProcessingCancelled()) {
        io.emit("error", errorResult.error);
        io.emit("update", errorResult);
      }
    }

    res.status(200).send("Retry completed");
  },
};

// Export the module
module.exports = {
  processTranscription,
  ...transcriptionController,
};
