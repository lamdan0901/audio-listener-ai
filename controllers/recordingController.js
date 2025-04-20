const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const { getFfmpegArgs, cleanupAudioFiles } = require("../utils/ffmpeg");
const {
  transcribeAudio,
  generateAnswer,
  processAudioWithGemini,
  streamGeneratedAnswer,
} = require("../utils/ai");

// Recording state variables
let ffmpegProcess = null;
let isRecording = false;
let currentOutputFile = null;
let lastProcessedFile = null;
let retryCount = 0;
let isProcessingCancelled = false; // Add flag to track cancellation status
let lastQuestion = null; // Store the last question for follow-up context

// Set up the recording directory and prepare output file
function setupRecordingEnvironment() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
  }

  // Generate unique output file name
  currentOutputFile = `audio/${Date.now()}.wav`;
  console.log(`Starting new recording to: ${currentOutputFile}`);
}

// Clean up any existing audio files before starting a new recording
function cleanupExistingAudioFiles() {
  console.log("Cleaning up existing audio files before starting new recording");
  // Delete all audio files in the audio directory
  const audioDir = path.join(__dirname, "..", "audio");
  cleanupAudioFiles(audioDir);

  // Also clean up the last processed file reference
  lastProcessedFile = null;

  // Do NOT reset lastQuestion here - we want to maintain context between recordings
  // This allows for follow-up questions across different recording sessions
}

// Start the FFmpeg process and set up all event handlers
function startFFmpegProcess(io, options = {}) {
  const ffmpegArgs = getFfmpegArgs(currentOutputFile, options);
  console.log("Starting FFmpeg with args:", ffmpegArgs.join(" "));

  // Spawn FFmpeg process for audio capture
  ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

  setupFFmpegErrorHandling(io);
  setupFFmpegProcessEvents(io);
}

// Set up stderr handling for FFmpeg
function setupFFmpegErrorHandling(io) {
  let startupErrorDetected = false;

  ffmpegProcess.stderr.on("data", (d) => {
    const error = d.toString();
    console.error("FFmpeg Error:", error);

    // Look for specific error patterns that indicate audio device issues
    const errorPatterns = [
      "No such filter",
      "Invalid argument",
      "Could not find",
      "Device not found",
      "Cannot open",
      "Failed to read",
      "Error opening",
      "Input/output error",
      "does not exist",
      "Could not open",
      "not found",
      "No such device",
    ];

    // Check if any error pattern matches
    const hasError = errorPatterns.some((pattern) => error.includes(pattern));

    if (hasError && !startupErrorDetected) {
      startupErrorDetected = true; // Prevent multiple error messages
      isRecording = false; // Reset recording state

      sendAppropriateErrorMessage(error, io);
      cleanupRecordingResources();
    }
  });
}

// Send different error messages based on the error type
function sendAppropriateErrorMessage(error, io) {
  if (
    error.includes("Device not found") ||
    error.includes("Could not find") ||
    error.includes("not found")
  ) {
    io.emit(
      "error",
      "Audio capture device not found. Check your audio settings."
    );
  } else if (error.includes("Access denied") || error.includes("Permission")) {
    io.emit(
      "error",
      "Permission denied accessing audio device. Check your permissions."
    );
  } else {
    io.emit(
      "error",
      "Audio capture device not working properly. Try restarting the application."
    );
  }
}

// Set up event handlers for the FFmpeg process
function setupFFmpegProcessEvents(io) {
  ffmpegProcess.on("error", (err) => handleFFmpegProcessError(err, io));
  ffmpegProcess.on("close", handleFFmpegProcessClose);
}

// Handle errors from the FFmpeg process
function handleFFmpegProcessError(err, io) {
  console.error("FFmpeg Process Error:", err);
  io.emit("error", "Failed to start audio capture");
  isRecording = false;
  cleanupOutputFile();
}

// Handle the FFmpeg process closing
function handleFFmpegProcessClose(code) {
  console.log(`FFmpeg exited with code ${code}`);
  isRecording = false;

  if (code !== 0 && code !== null) {
    console.error(`FFmpeg exited with code ${code}`);
    cleanupEmptyOutputFile();
  }

  currentOutputFile = null;
}

// Clean up all recording resources (process and file)
function cleanupRecordingResources() {
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill("SIGTERM");
    } catch (e) {
      console.error("Error killing ffmpeg process:", e);
    }
  }

  cleanupOutputFile();
}

// Clean up the output file if it was created
function cleanupOutputFile() {
  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    try {
      fs.unlinkSync(currentOutputFile);
      console.log(`Deleted audio file: ${currentOutputFile}`);
      currentOutputFile = null;
    } catch (e) {
      console.error("Error deleting file:", e);
    }
  }
}

// Clean up empty output file
function cleanupEmptyOutputFile() {
  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    const stats = fs.statSync(currentOutputFile);
    if (stats.size === 0) {
      // No data was recorded, so delete the file
      fs.unlinkSync(currentOutputFile);
      console.log(`Deleted empty audio file: ${currentOutputFile}`);
    }
  }
}

// Stop the FFmpeg recording process and clean up state
async function stopRecordingProcess() {
  // Safely stop ffmpeg process first
  if (ffmpegProcess) {
    console.log("Stopping FFmpeg process");
    ffmpegProcess.kill("SIGINT");

    // Allow a little time for the process to close and write final data
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Now handle state cleanup
  isRecording = false;
  currentOutputFile = null; // Clear it to prevent race conditions
}

// Validate that the audio file exists and has content
async function validateAudioFile(filePath) {
  // File validation
  if (!filePath) {
    console.error("No recording file was stored in currentOutputFile");
    throw new Error("No recording file was created");
  }

  // Check if the file exists
  console.log(`Checking if file exists: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    throw new Error("Recording file not found");
  }

  // Check file size - if it's empty, wait a bit and check again (could be delayed write)
  const stats = fs.statSync(filePath);
  console.log(`Initial file size check: ${stats.size} bytes`);

  if (stats.size === 0) {
    await waitForFileContent(filePath);
  }

  console.log("File validation successful, proceeding with processing");
}

// Wait for file to have content
async function waitForFileContent(filePath) {
  // Give it one more chance - wait a bit longer for any delayed writes
  console.log("File is empty, waiting to see if more data arrives...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check again
  if (fs.existsSync(filePath)) {
    const newStats = fs.statSync(filePath);
    console.log(`After waiting, file size is now: ${newStats.size} bytes`);

    if (newStats.size === 0) {
      throw new Error("Recording file is empty. No audio was captured.");
    }
  } else {
    throw new Error("Recording file disappeared during processing");
  }
}

// Process audio file to text and generate answer
async function processAudioToText(filePath, languageCode, lang, options = {}) {
  try {
    // Check if processing was cancelled
    if (isProcessingCancelled) {
      console.log("Processing cancelled, aborting transcription");
      return null;
    }

    // First attempt at transcription with normal settings
    let transcript;
    try {
      transcript = await transcribeAudio(filePath, languageCode, options);
    } catch (transcriptionError) {
      // Check if processing was cancelled while transcribing
      if (isProcessingCancelled) {
        console.log("Processing cancelled during transcription");
        return null;
      }

      console.error("Initial transcription error:", transcriptionError.message);

      // If first attempt fails with error, try with simpler settings
      if (options.retryAttempt) {
        // If we're already in a retry, use simpler settings
        console.log(
          "Retry with simpler settings since advanced settings failed"
        );
        const safeOptions = {
          ...options,
          useSimpleSettings: true,
        };

        try {
          transcript = await transcribeAudio(
            filePath,
            languageCode,
            safeOptions
          );
        } catch (secondError) {
          // Check if processing was cancelled during retry
          if (isProcessingCancelled) {
            console.log("Processing cancelled during transcription retry");
            return null;
          }

          console.error(
            "Second transcription attempt also failed:",
            secondError.message
          );
          return handleEmptyTranscript(languageCode, filePath);
        }
      } else {
        // Just pass on the error if it's not a retry
        throw transcriptionError;
      }
    }

    // Check if processing was cancelled after transcription
    if (isProcessingCancelled) {
      console.log(
        "Processing cancelled after transcription, aborting answer generation"
      );
      return null;
    }

    if (!transcript || transcript.trim() === "") {
      // If no transcript was detected, try one more time with adjusted options
      console.log(
        "No speech detected, retrying transcription with adjusted options..."
      );

      // Adjust options for retry - try with more sensitive settings
      const retryOptions = {
        ...options,
        retryAttempt: true,
        model: options.speechSpeed === "fast" ? "video" : "latest_long", // Use more sensitive models
      };

      // Use try-catch to handle potential errors in retry attempt
      let retryTranscript;
      try {
        retryTranscript = await transcribeAudio(
          filePath,
          languageCode,
          retryOptions
        );
      } catch (retryError) {
        // Check if processing was cancelled during retry
        if (isProcessingCancelled) {
          console.log("Processing cancelled during transcript retry");
          return null;
        }

        console.error("Error during retry transcription:", retryError.message);
        return handleEmptyTranscript(languageCode, filePath);
      }

      // Check if processing was cancelled after retry transcription
      if (isProcessingCancelled) {
        console.log("Processing cancelled after retry transcription");
        return null;
      }

      if (!retryTranscript || retryTranscript.trim() === "") {
        return handleEmptyTranscript(languageCode, filePath);
      }

      // Store the successfully transcribed question
      if (!options.isFollowUp) {
        lastQuestion = retryTranscript;
        console.log(`Storing new question (retry): ${lastQuestion}`);
      }

      // Use the previous question for context if this is a follow-up
      const contextQuestion = options.isFollowUp ? lastQuestion : null;
      console.log(
        `Using context question: ${contextQuestion || "None (new question)"}`
      );

      const answer = await generateAnswer(
        retryTranscript,
        lang,
        options.questionContext,
        contextQuestion
      );

      // Final cancellation check before returning results
      if (isProcessingCancelled) {
        console.log("Processing cancelled before returning results");
        return null;
      }

      return {
        transcript: retryTranscript,
        answer,
        audioFile: filePath,
        isFollowUp: options.isFollowUp,
      };
    }

    // Store the successfully transcribed question
    if (!options.isFollowUp) {
      lastQuestion = transcript;
      console.log(`Storing new question: ${lastQuestion}`);
    }

    // Use the previous question for context if this is a follow-up
    const contextQuestion = options.isFollowUp ? lastQuestion : null;
    console.log(
      `Using context question: ${contextQuestion || "None (new question)"}`
    );

    const answer = await generateAnswer(
      transcript,
      lang,
      options.questionContext,
      contextQuestion
    );

    // Final cancellation check before returning results
    if (isProcessingCancelled) {
      console.log("Processing cancelled before returning results");
      return null;
    }

    return {
      transcript,
      answer,
      audioFile: filePath,
      isFollowUp: options.isFollowUp,
    };
  } catch (error) {
    console.error("Error processing audio:", error);
    return handleEmptyTranscript(languageCode, filePath);
  }
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

// Process audio directly with Gemini (bypassing Speech-to-Text)
async function processAudioDirectlyWithGemini(
  filePath,
  lang,
  questionContext = "general"
) {
  try {
    console.log(`Processing audio directly with Gemini: ${filePath}`);

    // Check if processing is cancelled before starting
    if (isProcessingCancelled) {
      console.log("Processing cancelled, aborting Gemini processing");
      return null;
    }

    const result = await processAudioWithGemini(
      filePath,
      lang,
      questionContext
    );

    // Check if processing is cancelled after receiving results
    if (isProcessingCancelled) {
      console.log("Processing cancelled after Gemini processing");
      return null;
    }

    return {
      transcript: result.transcript || "Audio processed directly with Gemini",
      answer: result.answer,
      audioFile: filePath,
      processedWithGemini: true,
    };
  } catch (error) {
    console.error("Error processing with Gemini:", error);
    throw error;
  }
}

// Stream responses from Gemini to client via socket.io
async function streamResponseToClient(
  io,
  transcript,
  lang,
  questionContext,
  audioFile,
  streamOptions = {}
) {
  try {
    console.log("Starting streaming response generation");

    // Generate text in streaming mode - pass along follow-up context if needed
    const streamGenerator = streamGeneratedAnswer(
      transcript,
      lang,
      questionContext,
      streamOptions.isFollowUp ? lastQuestion : null
    );

    // Accumulate content to show complete answer at the end
    let fullAnswer = "";

    // Process each chunk as it arrives
    for await (const chunk of streamGenerator) {
      // Check if streaming has been cancelled
      if (isProcessingCancelled) {
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
      });
    }

    // Only send the final update if not cancelled
    if (!isProcessingCancelled) {
      io.emit("streamEnd", {
        fullAnswer,
        transcript: transcript,
        audioFile: audioFile,
        isFollowUp: streamOptions.isFollowUp,
      });
    }
  } catch (error) {
    console.error("Error streaming response:", error);
    if (!isProcessingCancelled) {
      io.emit("streamError", { error: error.message });
    }
  }
}

// Controller methods
const recordingController = {
  // Get the current recording status
  getStatus: () => {
    return {
      isRecording,
      currentFile: currentOutputFile,
      lastProcessedFile,
      hasLastQuestion: lastQuestion !== null,
      lastQuestionPreview: lastQuestion
        ? lastQuestion.substring(0, 50) +
          (lastQuestion.length > 50 ? "..." : "")
        : null,
    };
  },

  // Start a new recording session
  startRecording: (req, res, io) => {
    if (isRecording) {
      return res.status(400).send("Already recording");
    }

    try {
      // Reset retry count for new recording
      retryCount = 0;

      // Clean up any existing audio files first
      cleanupExistingAudioFiles();

      // Set up new recording environment
      setupRecordingEnvironment();

      // Start FFmpeg with options from the request
      const options = {
        duration: req.body.duration || 30,
        speechSpeed: req.body.speechSpeed || "normal",
      };

      startFFmpegProcess(io, options);
      isRecording = true;

      res.status(200).send("Recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      res.status(500).send(`Error starting recording: ${err.message}`);
      cleanupRecordingResources();
    }
  },

  // Stop recording and process the audio
  stopRecording: async (req, res, io) => {
    const lang = req.body.language === "en" ? "en" : "vi";
    const speechSpeed = req.body.speechSpeed || "normal";
    const questionContext = req.body.questionContext || "general";
    const isFollowUp = req.body.isFollowUp === true;
    const useStreaming = req.body.useStreaming !== false; // Default to true

    console.log(
      `Stop recording request received. Language: ${lang}, Speech speed: ${speechSpeed}, Context: ${questionContext}, IsFollowUp: ${isFollowUp}, Current stored question: "${lastQuestion}"`
    );

    // Reset cancellation flag for new processing task
    isProcessingCancelled = false;

    // If not currently recording, inform client and return
    if (!isRecording) {
      const errorMsg = "No active recording to stop";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    // Store output file path before stopping the process
    const fileToProcess = currentOutputFile;

    try {
      // Stop FFmpeg process first
      await stopRecordingProcess();

      // Inform client that we're processing the recording
      io.emit("processing");

      // Make sure the file has been written and contains data
      await validateAudioFile(fileToProcess);

      const languageCode = lang === "vi" ? "vi-VN" : "en-US";

      // Reset retry count for new recording
      retryCount = 0;

      // Process the audio to text with appropriate options
      const transcriptionOptions = {
        speechSpeed: speechSpeed,
        questionContext: questionContext,
        isFollowUp: isFollowUp,
      };

      // Only update the last processed file if we have a valid file
      lastProcessedFile = fileToProcess;

      // If this is a follow-up and we don't have a stored question, log a warning
      // but still proceed with the isFollowUp flag (the AI will just ignore the context)
      if (isFollowUp && !lastQuestion) {
        console.log(
          "Follow-up requested but no previous question exists - proceeding but may not have context"
        );
      }

      // Get the transcript first - we'll return early if cancelled
      let transcriptionResult;
      try {
        transcriptionResult = await transcribeAudio(
          fileToProcess,
          languageCode,
          transcriptionOptions
        );
      } catch (transcriptionError) {
        console.error(
          "Transcription error during processing:",
          transcriptionError.message
        );
        const errorResult = handleProcessingError(
          transcriptionError,
          lang,
          fileToProcess
        );
        if (!isProcessingCancelled) {
          io.emit("error", errorResult.error);
          io.emit("update", errorResult);
        }
        return res.status(200).send("Processing completed with errors");
      }

      // Check if we should continue
      if (isProcessingCancelled) {
        console.log("Processing was cancelled during transcription");
        return res.status(200).send("Processing cancelled");
      }

      if (!transcriptionResult || transcriptionResult.trim() === "") {
        // Handle empty transcript result
        const emptyResult = handleEmptyTranscript(languageCode, fileToProcess);
        if (!isProcessingCancelled) {
          io.emit("update", emptyResult);
        }
      } else if (useStreaming) {
        // Stream the response option
        io.emit("transcript", { transcript: transcriptionResult });

        // If this is a new question (not a follow-up), store it for future follow-ups
        if (!isFollowUp) {
          lastQuestion = transcriptionResult;
          console.log(`Storing new question from streaming: ${lastQuestion}`);
        }

        // Start streaming in the background with follow-up context if needed
        const streamOptions = {
          isFollowUp: isFollowUp,
        };

        streamResponseToClient(
          io,
          transcriptionResult,
          lang,
          questionContext,
          fileToProcess,
          streamOptions
        ).catch((error) => {
          console.error("Error in streaming background task:", error);
          if (!isProcessingCancelled) {
            io.emit("streamError", { error: error.message });
          }
        });
      } else {
        // If this is a new question (not a follow-up), store it for future follow-ups
        if (!isFollowUp) {
          lastQuestion = transcriptionResult;
          console.log(
            `Storing new question from non-streaming: ${lastQuestion}`
          );
        }

        // Use the previous question for context if this is a follow-up
        const contextQuestion = isFollowUp ? lastQuestion : null;

        // Use the traditional approach
        const answer = await generateAnswer(
          transcriptionResult,
          lang,
          questionContext,
          contextQuestion
        );

        // Only emit the update if processing wasn't cancelled
        if (!isProcessingCancelled) {
          io.emit("update", {
            transcript: transcriptionResult,
            answer,
            audioFile: fileToProcess,
            isFollowUp: isFollowUp,
          });
        }
      }
    } catch (err) {
      const errorResult = handleProcessingError(err, lang, fileToProcess);
      if (!isProcessingCancelled) {
        io.emit("error", errorResult.error);
        io.emit("update", errorResult);
      }
    } finally {
      // Don't delete the file after processing - we store it for possible retry
      await cleanupAfterProcessing(fileToProcess);
    }

    res.status(200).send("Recording stopped");
  },

  // Retry transcription without re-recording
  retryTranscription: async (req, res, io) => {
    const lang = req.body.language === "en" ? "en" : "vi";
    const speechSpeed = req.body.speechSpeed || "normal";
    const questionContext = req.body.questionContext || "general";
    const isFollowUp = req.body.isFollowUp === true;
    const useStreaming = req.body.useStreaming !== false; // Default to true

    // Reset cancellation flag for new processing task
    isProcessingCancelled = false;

    // Allow specifying a specific audio file to process or use the last processed file
    const fileToProcess = req.body.audioFile || lastProcessedFile;
    console.log(
      `Retry request received. Processing file: ${fileToProcess}, Retry count: ${retryCount}, IsFollowUp: ${isFollowUp}, Current stored question: "${lastQuestion}"`
    );

    if (!fileToProcess || !fs.existsSync(fileToProcess)) {
      const errorMsg = "No audio file available for retry";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    try {
      io.emit("processing");

      const languageCode = lang === "vi" ? "vi-VN" : "en-US";

      // Increment retry count for this file to try different models
      retryCount++;

      // Use different transcription strategies based on retry count
      const transcriptionOptions = {
        speechSpeed: speechSpeed,
        questionContext: questionContext,
        retryAttempt: true, // Flag this as a retry attempt
        attemptNumber: retryCount,
        isFollowUp: isFollowUp,
      };

      // If this is a follow-up and we don't have a stored question, log a warning
      // but still proceed with the isFollowUp flag
      if (isFollowUp && !lastQuestion) {
        console.log(
          "Follow-up requested but no previous question exists - proceeding but may not have context"
        );
      }

      console.log(`Using retry strategy #${retryCount % 3}`);

      // Get the transcript first
      let transcriptionResult;
      try {
        transcriptionResult = await transcribeAudio(
          fileToProcess,
          languageCode,
          transcriptionOptions
        );
      } catch (transcriptionError) {
        console.error(
          "Transcription error during retry:",
          transcriptionError.message
        );
        const errorResult = handleProcessingError(
          transcriptionError,
          lang,
          fileToProcess
        );
        if (!isProcessingCancelled) {
          io.emit("error", errorResult.error);
          io.emit("update", errorResult);
        }
        return res.status(200).send("Retry processing completed with errors");
      }

      if (!transcriptionResult || transcriptionResult.trim() === "") {
        const emptyResult = handleEmptyTranscript(languageCode, fileToProcess);
        if (!isProcessingCancelled) {
          io.emit("update", emptyResult);
        }
      } else if (useStreaming) {
        // Stream the response
        io.emit("transcript", { transcript: transcriptionResult });

        // If this is a new question (not a follow-up), store it for future follow-ups
        if (!isFollowUp) {
          lastQuestion = transcriptionResult;
          console.log(
            `Storing new question from retry streaming: ${lastQuestion}`
          );
        }

        // Start streaming in the background with follow-up context if needed
        const streamOptions = {
          isFollowUp: isFollowUp,
        };

        streamResponseToClient(
          io,
          transcriptionResult,
          lang,
          questionContext,
          fileToProcess,
          streamOptions
        ).catch((error) => {
          console.error("Error in streaming background task:", error);
          if (!isProcessingCancelled) {
            io.emit("streamError", { error: error.message });
          }
        });
      } else {
        // If this is a new question (not a follow-up), store it for future follow-ups
        if (!isFollowUp) {
          lastQuestion = transcriptionResult;
          console.log(
            `Storing new question from retry non-streaming: ${lastQuestion}`
          );
        }

        // Use the previous question for context if this is a follow-up
        const contextQuestion = isFollowUp ? lastQuestion : null;

        // Use the traditional approach
        const answer = await generateAnswer(
          transcriptionResult,
          lang,
          questionContext,
          contextQuestion
        );

        // Only emit the update if processing wasn't cancelled
        if (!isProcessingCancelled) {
          io.emit("update", {
            transcript: transcriptionResult,
            answer,
            audioFile: fileToProcess,
            isFollowUp: isFollowUp,
          });
        }
      }
    } catch (err) {
      const errorResult = handleProcessingError(err, lang, fileToProcess);
      if (!isProcessingCancelled) {
        io.emit("error", errorResult.error);
        io.emit("update", errorResult);
      }
    }

    res.status(200).send("Retry processing completed");
  },

  // Process audio directly with Gemini
  processWithGemini: async (req, res, io) => {
    const lang = req.body.language === "en" ? "en" : "vi";
    const questionContext = req.body.questionContext || "general";
    const isFollowUp = req.body.isFollowUp === true;
    const useStreaming = req.body.useStreaming !== false; // Default to true

    // Reset cancellation flag for new processing task
    isProcessingCancelled = false;

    // Use the last processed file
    const fileToProcess = req.body.audioFile || lastProcessedFile;
    console.log(
      `Gemini processing request received. Processing file: ${fileToProcess}, IsFollowUp: ${isFollowUp}, Current stored question: "${lastQuestion}"`
    );

    if (!fileToProcess || !fs.existsSync(fileToProcess)) {
      const errorMsg = "No audio file available for Gemini processing";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    try {
      // Reset retry count when switching to Gemini
      retryCount = 0;

      // Inform client we're processing
      io.emit("processing");

      // If this is a follow-up and we don't have a stored question, log a warning
      if (isFollowUp && !lastQuestion) {
        console.log(
          "Follow-up requested but no previous question exists - proceeding but may not have context"
        );
      }

      // Process audio directly with Gemini
      const result = await processAudioDirectlyWithGemini(
        fileToProcess,
        lang,
        questionContext
      );

      // Add follow-up flag to the result
      if (result && !isProcessingCancelled) {
        result.isFollowUp = isFollowUp;
      }

      // If this is a new question (not a follow-up) and we have a result, store it
      if (!isFollowUp && result && result.transcript) {
        lastQuestion = result.transcript;
        console.log(`Storing new question from Gemini: ${lastQuestion}`);
      }

      // Only continue if we have results and processing wasn't cancelled
      if (result && !isProcessingCancelled) {
        // If streaming is enabled and we have a transcript, stream the answer
        if (useStreaming && result.transcript) {
          // Emit the transcript first
          io.emit("transcript", { transcript: result.transcript });

          // Start streaming in the background
          const streamOptions = {
            isFollowUp: isFollowUp,
          };

          streamResponseToClient(
            io,
            result.transcript,
            lang,
            questionContext,
            fileToProcess,
            streamOptions
          ).catch((error) => {
            console.error("Error in streaming background task:", error);
            if (!isProcessingCancelled) {
              io.emit("streamError", { error: error.message });
            }
          });
        } else {
          // Use the traditional approach (non-streaming)
          io.emit("update", result);
        }
      }
    } catch (err) {
      const errorResult = handleProcessingError(err, lang, fileToProcess);
      if (!isProcessingCancelled) {
        io.emit("error", errorResult.error);
        io.emit("update", errorResult);
      }
    }

    res.status(200).send("Gemini processing completed");
  },

  // Cancel any ongoing recording or processing
  cancelProcessing: async (req, res, io) => {
    console.log("Cancelling current recording or processing");

    try {
      // Set the cancellation flag to prevent further processing
      isProcessingCancelled = true;

      // If recording is in progress, stop it
      if (isRecording) {
        console.log("Stopping active recording due to cancellation");
        await stopRecordingProcess();
        isRecording = false;
      }

      // Cleanup any current resources
      cleanupRecordingResources();

      // Inform the client that the operation was cancelled
      io.emit("error", "Operation cancelled by user");

      // Send a stream end event for streaming operations
      io.emit("streamEnd", {
        cancelled: true,
        message: "Operation cancelled by user",
      });

      // Reset status
      const idleStatus = {
        transcript: "",
        answer: "Operation cancelled",
        audioFile: null,
      };
      io.emit("update", idleStatus);

      res.status(200).send("Operation cancelled");
    } catch (err) {
      console.error("Error during cancellation:", err);
      io.emit("error", "Error during cancellation");
      res.status(500).send("Error during cancellation");
    } finally {
      // Ensure cancellation flag is reset after a short delay
      // to allow any in-progress operations to complete
      setTimeout(() => {
        isProcessingCancelled = false;
      }, 2000);
    }
  },

  // Stream response for an existing transcript
  streamResponse: async (req, res, io) => {
    const transcript = req.body.transcript;
    const lang = req.body.language === "en" ? "en" : "vi";
    const questionContext = req.body.questionContext || "general";
    const audioFile = req.body.audioFile || lastProcessedFile;

    // Reset cancellation flag
    isProcessingCancelled = false;

    if (!transcript) {
      const errorMsg = "No transcript available for streaming";
      console.error(errorMsg);
      io.emit("error", errorMsg);
      return res.status(400).send(errorMsg);
    }

    try {
      // Start streaming in the background
      streamResponseToClient(
        io,
        transcript,
        lang,
        questionContext,
        audioFile
      ).catch((error) => {
        console.error("Error in streaming background task:", error);
        if (!isProcessingCancelled) {
          io.emit("streamError", { error: error.message });
        }
      });

      // Return success immediately as streaming will happen over socket.io
      res.status(200).send("Streaming started");
    } catch (err) {
      console.error("Error starting streaming:", err);
      io.emit("error", "Failed to start streaming");
      res.status(500).send("Error starting streaming");
    }
  },
};

module.exports = recordingController;
