const fs = require("fs");
const path = require("path");
const baseController = require("./baseController");
const fileController = require("./fileController");
const { tryCatch } = require("../lib/tryCatch");
const backendEvents = require("../lib/events");

/**
 * Process an uploaded audio file
 * @param {string} filePath - Path to the uploaded audio file
 * @param {Object} params - Processing parameters
 * @returns {Promise<boolean>} - Success status
 */
async function processUploadedAudio(filePath, params) {
  console.log(`Processing uploaded audio file: ${filePath}`);

  try {
    // Validate the uploaded file and convert if necessary
    const validatedFilePath = await fileController.validateAudioFile(filePath);

    // Set the current file for processing
    baseController.setCurrentOutputFile(validatedFilePath);
    baseController.setLastProcessedFile(validatedFilePath);

    // Get reference to the AI processing controller
    const aiProcessingController = require("./aiProcessingController");

    // NEW LOGIC: Process audio directly with Gemini (bypassing separate transcription)
    console.log("Using direct Gemini audio processing");
    await aiProcessingController.processAudioFileWithGemini(
      validatedFilePath,
      params
    );

    return true;
  } catch (error) {
    console.error("Error processing uploaded audio:", error);
    backendEvents.emit("error", `Error processing audio: ${error.message}`);
    return false;
  }
}

// Controller methods
const recordingController = {
  // Get the current recording status
  getStatus: () => {
    return baseController.getStatus();
  },

  // Handle uploaded audio file from frontend
  handleAudioUpload: async (req, res) => {
    console.log("Audio file upload received from frontend");

    // Log request details for debugging
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);

    // Check if we received a file
    if (!req.file) {
      console.error("No file was uploaded");
      return res.status(400).send("No audio file was uploaded");
    }

    // Log file details
    console.log("Uploaded file details:", {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    // Get the uploaded file path
    const uploadedFilePath = req.file.path;
    console.log(`File uploaded to: ${uploadedFilePath}`);

    // Parse parameters from the request body
    const params = baseController.prepareRequestParams({
      ...req.body,
      audioFile: uploadedFilePath,
    });

    // Reset retry count for new upload
    baseController.setRetryCount(0);

    // Inform client that we're processing
    backendEvents.emit("processing");

    try {
      // Process the uploaded audio
      const processingResult = await tryCatch(
        processUploadedAudio(uploadedFilePath, params)
      );

      if (processingResult.error) {
        console.error(
          "Error processing uploaded audio:",
          processingResult.error
        );
        const errorResult = baseController.handleProcessingError(
          processingResult.error,
          params.lang,
          uploadedFilePath
        );

        if (!baseController.isProcessingCancelled()) {
          backendEvents.emit("error", errorResult.error);
          backendEvents.emit("update", errorResult);
        }

        return res.status(500).json({
          success: false,
          error: `Error processing audio: ${processingResult.error.message}`,
          errorDetails: errorResult,
        });
      }

      // Don't delete the file after processing - we store it for possible retry
      await baseController.cleanupAfterProcessing(uploadedFilePath);

      // Return success response with more details
      return res.status(200).json({
        success: true,
        message: "Audio processed successfully",
        hasLastQuestion: true,
        lastQuestionPreview:
          baseController.getLastQuestion()?.substring(0, 50) + "...",
      });
    } catch (error) {
      console.error("Unexpected error in handleAudioUpload:", error);
      backendEvents.emit("error", `Unexpected error: ${error.message}`);

      return res.status(500).json({
        success: false,
        error: `Unexpected error: ${error.message}`,
      });
    }
  },

  // Legacy method - Start a new recording session (kept for backward compatibility)
  // Now just returns a message that clients should use the upload endpoint
  startRecording: (_req, res) => {
    console.log(
      "startRecording endpoint called - informing client to use upload endpoint"
    );
    res
      .status(400)
      .send(
        "Direct audio recording is no longer supported. Please upload audio files to the /upload endpoint instead."
      );
  },

  // Cancel any ongoing processing
  cancelRecording: async (_req, res) => {
    console.log("Cancelling current processing");

    // Set the cancellation flag
    baseController.setCancelled(true);

    // Emit cancellation event
    backendEvents.emit("processingCancelled", {
      message: "Processing cancelled by user",
    });

    res.status(200).send("Processing cancelled");
  },

  // Clean up resources (no longer needed for FFmpeg, but kept for file cleanup)
  cleanupRecordingResources: () => {
    fileController.cleanupOutputFile();
  },
};

module.exports = recordingController;
