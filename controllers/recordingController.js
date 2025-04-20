const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const { getFfmpegArgs } = require("../utils/ffmpeg");
const { transcribeAudio, generateAnswer } = require("../utils/ai");

// Recording state variables
let ffmpegProcess = null;
let isRecording = false;
let currentOutputFile = null;

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
  const transcript = await transcribeAudio(filePath, languageCode, options);

  if (!transcript) {
    return handleEmptyTranscript(languageCode);
  }

  const answer = await generateAnswer(transcript, lang);
  return { transcript, answer };
}

// Handle the case where no speech was detected
function handleEmptyTranscript(languageCode) {
  const apology = languageCode.startsWith("vi")
    ? "Xin lỗi, tôi không nghe rõ. Vui lòng thử lại."
    : "Sorry, I didn't catch that. Please try again.";

  return {
    transcript: "",
    answer: apology,
  };
}

// Handle errors during processing
function handleProcessingError(err, lang) {
  console.error("Processing error:", err);
  const errorMessage = err.message || "An error occurred during processing";

  return {
    error: errorMessage,
    transcript: "",
    answer: lang === "vi" ? `Lỗi: ${errorMessage}` : `Error: ${errorMessage}`,
  };
}

// Clean up after processing is complete
async function cleanupAfterProcessing(filePath) {
  // Add delay before attempting to delete the file
  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted audio file: ${filePath}`);
    }
  } catch (deleteError) {
    console.error("Error deleting audio file:", deleteError);
  }
}

// Controller methods
const recordingController = {
  // Get the current recording status
  getStatus: () => {
    return { isRecording };
  },

  // Start recording
  startRecording: (req, res, io) => {
    if (isRecording) {
      console.log("Recording already in progress, ignoring start request");
      return res.status(400).send("Already recording");
    }

    try {
      const options = {
        speechSpeed: req.body.speechSpeed || "normal",
        duration: req.body.duration || 30,
      };

      console.log("Recording options:", options);
      setupRecordingEnvironment();
      startFFmpegProcess(io, options);
      isRecording = true;
      res.status(200).send("Recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      res.status(500).send(`Failed to start recording: ${err.message}`);
    }
  },

  // Stop recording and process audio
  stopRecording: async (req, res, io) => {
    if (!isRecording) return res.status(400).send("Not recording");
    const lang = req.body.language === "en" ? "en" : "vi";
    const speechSpeed = req.body.speechSpeed || "normal";

    // Declare fileToProcess at the top level of the function so it's available in the finally block
    let fileToProcess = currentOutputFile;
    console.log(`Stop request received. Current file: ${fileToProcess}`);

    try {
      await stopRecordingProcess();
      await validateAudioFile(fileToProcess);

      io.emit("processing");

      const languageCode = lang === "vi" ? "vi-VN" : "en-US";
      const transcriptionOptions = {
        speechSpeed: speechSpeed,
      };

      const result = await processAudioToText(
        fileToProcess,
        languageCode,
        lang,
        transcriptionOptions
      );

      if (result) {
        io.emit("update", result);
      }
    } catch (err) {
      const errorResult = handleProcessingError(err, lang);
      io.emit("error", errorResult.error);
      io.emit("update", {
        transcript: errorResult.transcript,
        answer: errorResult.answer,
      });
    } finally {
      await cleanupAfterProcessing(fileToProcess);
    }

    res.status(200).send("Recording stopped");
  },
};

module.exports = recordingController;
