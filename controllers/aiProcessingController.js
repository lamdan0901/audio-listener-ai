const fs = require("fs");
const {
  generateAnswer,
  processAudioWithGemini,
  streamGeneratedAnswer,
} = require("../utils/ai");
const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");

/**
 * Handles sending updates to client based on transcription result
 * @param {Object} io - Socket.io instance
 * @param {string} transcript - Transcription result
 * @param {Object} params - Processing parameters
 * @param {string} fileToProcess - Audio file path
 * @returns {Promise<void>}
 */
async function handleTranscriptionResult(
  io,
  transcript,
  params,
  fileToProcess
) {
  // Check if we should continue
  if (baseController.isProcessingCancelled()) {
    console.log("Processing was cancelled during transcription");
    return;
  }

  if (!transcript || transcript.trim() === "") {
    // Handle empty transcript result
    const emptyResult = baseController.handleEmptyTranscript(
      params.languageCode,
      fileToProcess
    );
    if (!baseController.isProcessingCancelled()) {
      io.emit("update", emptyResult);
    }
  } else if (params.useStreaming) {
    // Stream the response option
    io.emit("transcript", { transcript });

    // Handle follow-up logic
    baseController.handleFollowUpLogic(params.isFollowUp, transcript);

    // Start streaming in the background with follow-up context if needed
    const streamOptions = {
      isFollowUp: params.isFollowUp,
      customContext: params.customContext,
    };

    streamResponseToClient(
      io,
      transcript,
      params.lang,
      params.questionContext,
      fileToProcess,
      streamOptions
    ).catch((error) => {
      console.error("Error in streaming background task:", error);
      if (!baseController.isProcessingCancelled()) {
        io.emit("streamError", { error: error.message });
      }
    });
  } else {
    // Handle follow-up logic and get context question
    const contextQuestion = baseController.handleFollowUpLogic(
      params.isFollowUp,
      transcript
    );

    // Use the traditional approach
    const answer = await generateAnswer(
      transcript,
      params.lang,
      params.questionContext,
      contextQuestion
    );

    // Only emit the update if processing wasn't cancelled
    if (!baseController.isProcessingCancelled()) {
      io.emit("update", {
        transcript,
        answer,
        audioFile: fileToProcess,
        isFollowUp: params.isFollowUp,
      });
    }
  }
}

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
  customContext = ""
) {
  console.log(`Processing audio directly with Gemini: ${filePath}`);

  // Check if processing is cancelled before starting
  if (baseController.isProcessingCancelled()) {
    console.log("Processing cancelled, aborting Gemini processing");
    return null;
  }

  const result = await tryCatch(
    processAudioWithGemini(filePath, lang, questionContext, customContext)
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
  io,
  transcript,
  lang,
  questionContext,
  audioFile,
  streamOptions = {}
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
        streamOptions.customContext || ""
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
        io.emit("streamChunk", {
          chunk,
          transcript: transcript,
          audioFile: audioFile,
          processedWithGemini: streamOptions.processedWithGemini || false,
        });
      }

      // Only send the final update if not cancelled
      if (!baseController.isProcessingCancelled()) {
        io.emit("streamEnd", {
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
      io.emit("streamError", { error: streamResult.error.message });
    }
  }
}

// Controller methods
const aiProcessingController = {
  // Process audio with Gemini AI directly
  processWithGemini: async (req, res, io) => {
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
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    const processingResult = await tryCatch(
      (async () => {
        // Reset retry count when switching to Gemini
        baseController.setRetryCount(0);

        // Inform client we're processing
        io.emit("processing");

        // Process audio directly with Gemini
        const result = await processAudioDirectlyWithGemini(
          fileToProcess,
          params.lang,
          params.questionContext,
          params.customContext
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
            io.emit("transcript", {
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
              io,
              result.transcript,
              params.lang,
              params.questionContext,
              fileToProcess,
              streamOptions
            ).catch((error) => {
              console.error("Error in streaming background task:", error);
              if (!baseController.isProcessingCancelled()) {
                io.emit("streamError", { error: error.message });
              }
            });
          } else {
            // Use the traditional approach (non-streaming)
            io.emit("update", result);
          }
        }

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

    res.status(200).send("Gemini processing completed");
  },

  // Stream response for an existing transcript
  streamResponse: async (req, res, io) => {
    // Parse and prepare request parameters
    const params = baseController.prepareRequestParams(req.body);
    const transcript = req.body.transcript;
    const audioFile = params.audioFile || baseController.getLastProcessedFile();

    // Reset cancellation flag
    baseController.setCancelled(false);

    if (!transcript) {
      const errorMsg = "No transcript available for streaming";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    const streamResult = await tryCatch(
      streamResponseToClient(
        io,
        transcript,
        params.lang,
        params.questionContext,
        audioFile
      )
    );

    if (streamResult.error) {
      console.error("Error in streaming background task:", streamResult.error);
      if (!baseController.isProcessingCancelled()) {
        io.emit("streamError", { error: streamResult.error.message });
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
  handleTranscriptionResult,
  processAudioDirectlyWithGemini,
  streamResponseToClient,
  ...aiProcessingController,
};
