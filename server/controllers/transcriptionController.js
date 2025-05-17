const fs = require("fs");
const { transcribeAudio } = require("../utils/ai");
const baseController = require("./baseController");
const fileController = require("./fileController");
const { tryCatch } = require("../lib/tryCatch");
const backendEvents = require("../lib/events");

/**
 * Processes audio transcription with error handling
 * @param {string} fileToProcess - Audio file path
 * @param {Object} params - Processing parameters
 * @param {Object} transcriptionOptions - Options for transcription
 * @returns {Promise<string|null>} - Transcription result or null if error/cancelled
 */
async function processTranscription(
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
      backendEvents.emit("error", errorResult.error);
      backendEvents.emit("update", errorResult);
    }
    return null;
  }

  return result.data;
}

const transcriptionController = {
  // Process audio file (legacy endpoint - maintained for backward compatibility)
  stopRecording: async (req, res) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);

    console.log(
      `Stop recording request received (legacy endpoint). Language: ${
        params.lang
      }, Context: ${params.questionContext}, Custom Context: ${
        params.customContext ? "provided" : "none"
      }, IsFollowUp: ${
        params.isFollowUp
      }, Current stored question: "${baseController.getLastQuestion()}"`
    );

    // Reset cancellation flag for new processing task
    baseController.setCancelled(false);

    // Check if an audio file was provided in the request
    if (req.file) {
      // If we have a file upload, process it
      const fileToProcess = req.file.path;
      console.log(`Processing uploaded file: ${fileToProcess}`);

      // Inform client that we're processing
      backendEvents.emit("processing");

      // Process the uploaded file
      await this.processUploadedFile(fileToProcess, params, res);
      return;
    } else if (params.audioFile) {
      // If audioFile parameter was provided, use that
      const fileToProcess = params.audioFile;
      console.log(`Processing specified audio file: ${fileToProcess}`);

      // Inform client that we're processing
      backendEvents.emit("processing");

      // Process the specified file
      await this.processUploadedFile(fileToProcess, params, res);
      return;
    } else {
      // Legacy behavior - check if we were recording
      if (!baseController.getIsRecording()) {
        const errorMsg = "No active recording or audio file provided";
        console.error(errorMsg);
        backendEvents.emit("error", errorMsg);
        return res.status(400).send(errorMsg);
      }

      // Store output file path
      const fileToProcess = baseController.getCurrentOutputFile();

      // Legacy recording handling
      const processingResult = await tryCatch(
        (async () => {
          console.log("Legacy recording mode - this is deprecated");

          // Inform client that we're processing
          backendEvents.emit("processing");

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
          backendEvents.emit("error", errorResult.error);
          backendEvents.emit("update", errorResult);
        }
      }

      // Don't delete the file after processing - we store it for possible retry
      await baseController.cleanupAfterProcessing(fileToProcess);

      res.status(200).send("Audio processed successfully");
    }
  },

  // Process an uploaded file
  processUploadedFile: async (filePath, params, res) => {
    if (!filePath || !fs.existsSync(filePath)) {
      const errorMsg = "Audio file not found or invalid";
      console.error(errorMsg);
      backendEvents.emit("error", errorMsg);
      if (res) res.status(400).send(errorMsg);
      return false;
    }

    // Reset retry count for new file
    baseController.setRetryCount(0);

    // Process the audio file
    const processingResult = await tryCatch(
      (async () => {
        // Make sure the file has data and convert if necessary
        const validatedFilePath = await fileController.validateAudioFile(
          filePath
        );

        // Process the audio to text with appropriate options
        const transcriptionOptions = {
          questionContext: params.questionContext,
          customContext: params.customContext,
          isFollowUp: params.isFollowUp,
        };

        // Update the last processed file with the validated/converted file path
        baseController.setLastProcessedFile(validatedFilePath);

        // Get the transcript using the validated/converted file
        const transcriptionResult = await processTranscription(
          validatedFilePath,
          params,
          transcriptionOptions
        );

        // If transcription failed or was cancelled, exit early
        if (transcriptionResult === null) {
          return false;
        }

        // Get reference to the AI processing controller
        const aiProcessingController = require("./aiProcessingController");

        // Handle the transcription result with the validated/converted file
        await aiProcessingController.handleTranscriptionResult(
          transcriptionResult,
          params,
          validatedFilePath
        );

        return true;
      })()
    );

    if (processingResult.error) {
      // Use the original file path for error handling if we don't have a validated path
      const errorResult = baseController.handleProcessingError(
        processingResult.error,
        params.lang,
        filePath
      );
      if (!baseController.isProcessingCancelled()) {
        backendEvents.emit("error", errorResult.error);
        backendEvents.emit("update", errorResult);
      }

      if (res)
        res
          .status(500)
          .send(`Error processing audio: ${processingResult.error.message}`);
      return false;
    }

    // Don't delete the file after processing - we store it for possible retry
    await baseController.cleanupAfterProcessing(filePath);

    if (res) res.status(200).send("Audio processed successfully");
    return true;
  },

  // Retry transcription with different settings
  retryTranscription: async (req, res) => {
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
      backendEvents.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    const processingResult = await tryCatch(
      (async () => {
        backendEvents.emit("processing");

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
        backendEvents.emit("error", errorResult.error);
        backendEvents.emit("update", errorResult);
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
