const fs = require("fs");
const {
  generateAnswer,
  processAudioWithGemini,
  streamGeneratedAnswer,
} = require("../utils/ai");
const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");
const backendEvents = require("../lib/events");

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
  modelName = null
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
      modelName
    )
  );

  if (result.error) {
    console.error("Error processing audio with Gemini:", result.error.message);
    return null;
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

/**
 * Stream responses from Gemini to client via socket.io
 * @param {Object} io - Socket.io instance
 * @param {string} transcript - Transcription text
 * @param {string} lang - Language code
 * @param {string} questionContext - Context for the question
 * @param {string} audioFile - Path to the audio file
 * @param {Object} streamOptions - Options for streaming
 * @returns {Promise<void>}
 */
async function streamResponseToClient(
  transcript,
  lang,
  questionContext,
  audioFile,
  streamOptions = {},
  modelName = null
) {
  console.log("Starting streaming response generation");

  // Generate text in streaming mode - pass along follow-up context if needed
  const streamResult = await tryCatch(
    (async () => {
      const streamGenerator = streamGeneratedAnswer(
        transcript,
        lang,
        questionContext,
        streamOptions.isFollowUp ? baseController.getLastQuestion() : null,
        streamOptions.customContext || "",
        modelName
      );

      // Accumulate content to show complete answer at the end
      let fullAnswer = "";

      // Process each chunk as it arrives
      for await (const chunk of streamGenerator) {
        // Check if streaming has been cancelled
        if (baseController.isProcessingCancelled()) {
          console.log("Streaming cancelled, stopping generator");
          break;
        }

        // Accumulate the full answer
        fullAnswer += chunk;

        // Emit the chunk to the client
        backendEvents.emit("streamChunk", {
          chunk,
          transcript: transcript,
          audioFile: audioFile,
          processedWithGemini: streamOptions.processedWithGemini || false,
        });
      }

      // Only send the final update if not cancelled
      if (!baseController.isProcessingCancelled()) {
        backendEvents.emit("streamEnd", {
          fullAnswer,
          transcript: transcript,
          audioFile: audioFile,
          isFollowUp: streamOptions.isFollowUp,
          processedWithGemini: streamOptions.processedWithGemini || false,
        });
      }

      return true;
    })()
  );

  if (streamResult.error) {
    console.error("Error streaming response:", streamResult.error);
    if (!baseController.isProcessingCancelled()) {
      backendEvents.emit("streamError", { error: streamResult.error.message });
    }
  }
}

// Controller methods
const aiProcessingController = {
  // Process audio file with Gemini Logic
  processAudioFileWithGemini: async (fileToProcess, params) => {
    // Reset retry count when switching to Gemini
    baseController.setRetryCount(0);

    // Inform client we're processing
    backendEvents.emit("processing");

    // Process audio directly with Gemini
    const result = await processAudioDirectlyWithGemini(
      fileToProcess,
      params.lang,
      params.questionContext,
      params.customContext,
      params.model
    );

    // Add follow-up flag to the result
    if (result && !baseController.isProcessingCancelled()) {
      result.isFollowUp = params.isFollowUp;
    }

    // Handle follow-up logic
    if (!params.isFollowUp && result && result.transcript) {
      baseController.setLastQuestion(result.transcript);
      console.log(
        `Storing new question from Gemini: ${baseController.getLastQuestion()}`
      );
    }

    // Only continue if we have results and processing wasn't cancelled
    if (result && !baseController.isProcessingCancelled()) {
      // If streaming is enabled and we have a transcript, stream the answer
      if (params.useStreaming && result.transcript) {
        // Emit the transcript first
        backendEvents.emit("transcript", {
          transcript: result.transcript,
          processedWithGemini: true,
        });

        // Start streaming in the background
        const streamOptions = {
          isFollowUp: params.isFollowUp,
          customContext: params.questionContext,
          processedWithGemini: true,
        };

        streamResponseToClient(
          result.transcript,
          params.lang,
          params.questionContext,
          fileToProcess,
          streamOptions,
          params.model
        ).catch((error) => {
          console.error("Error in streaming background task:", error);
          if (!baseController.isProcessingCancelled()) {
            backendEvents.emit("streamError", { error: error.message });
          }
        });
      } else {
        // Use the traditional approach (non-streaming)
        backendEvents.emit("update", result);
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
      }, Current stored question: "${baseController.getLastQuestion()}"`
    );

    // Reset cancellation flag for new processing task
    baseController.setCancelled(false);

    if (!fileToProcess || !fs.existsSync(fileToProcess)) {
      const errorMsg = "No audio file available for Gemini processing";
      console.error(errorMsg);
      backendEvents.emit("error", errorMsg); // Use backendEvents here too
      return res.status(400).send(errorMsg);
    }

    const processingResult = await tryCatch(
      aiProcessingController.processAudioFileWithGemini(fileToProcess, params)
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

    res.status(200).send("Gemini processing completed");
  },

  // Stream response for an existing transcript
  streamResponse: async (req, res) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);
    const transcript = req.body.transcript;
    const audioFile = params.audioFile || baseController.getLastProcessedFile();

    // Reset cancellation flag
    baseController.setCancelled(false);

    if (!transcript) {
      const errorMsg = "No transcript available for streaming";
      console.error(errorMsg);
      backendEvents.emit("error", errorMsg); // Use backendEvents here too
      return res.status(400).send(errorMsg);
    }

    const streamResult = await tryCatch(
      streamResponseToClient(
        transcript,
        params.lang,
        params.questionContext,
        audioFile,
        {},
        params.model
      )
    );

    if (streamResult.error) {
      console.error("Error in streaming background task:", streamResult.error);
      if (!baseController.isProcessingCancelled()) {
        backendEvents.emit("streamError", {
          error: streamResult.error.message,
        });
      }
      res.status(500).send("Error starting streaming");
    } else {
      // Return success if streaming started
      res.status(200).send("Streaming started");
    }
  },
};

// Export the module
module.exports = {
  processAudioDirectlyWithGemini,
  streamResponseToClient,
  ...aiProcessingController,
};
