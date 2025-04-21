const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getFfmpegArgs } = require("../utils/ffmpeg");
const baseController = require("./baseController");
const fileController = require("./fileController");
const { tryCatch } = require("../lib/tryCatch");

// FFmpeg process reference
let ffmpegProcess = null;

// Start the FFmpeg process and set up all event handlers
function startFFmpegProcess(io, options = {}) {
  const currentOutputFile = baseController.getCurrentOutputFile();
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
    const message = d.toString();

    // Check if this is progress information (contains size=, time=, etc.)
    const isProgressInfo =
      message.includes("size=") &&
      message.includes("time=") &&
      message.includes("bitrate=");

    // Check if this is metadata information
    const isMetadata =
      message.includes("Metadata:") || message.includes("encoder");

    // Only log as error if it's not progress info or metadata
    if (!isProgressInfo && !isMetadata) {
      console.error("Information from FFmpeg:", message);

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
      const hasError = errorPatterns.some((pattern) =>
        message.includes(pattern)
      );

      if (hasError && !startupErrorDetected) {
        startupErrorDetected = true; // Prevent multiple error messages
        baseController.setIsRecording(false); // Reset recording state

        sendAppropriateErrorMessage(message, io);
        cleanupRecordingResources();
      }
    } else {
      // For progress information, log at debug level or just skip logging
      if (isProgressInfo) {
        // Optional: log progress at debug level
        // console.debug("FFmpeg Progress:", message.trim());
      } else if (isMetadata) {
        // Optional: log metadata at info level
        // console.info("FFmpeg Metadata:", message.trim());
      }
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
  baseController.setIsRecording(false);
  fileController.cleanupOutputFile();
}

// Handle the FFmpeg process closing
function handleFFmpegProcessClose(code) {
  console.log(`FFmpeg exited with code ${code}`);
  baseController.setIsRecording(false);

  if (code !== 0 && code !== null) {
    console.error(`FFmpeg exited with code ${code}`);
    fileController.cleanupEmptyOutputFile();
  }

  baseController.setCurrentOutputFile(null);
}

// Clean up all recording resources (process and file)
function cleanupRecordingResources() {
  if (ffmpegProcess) {
    tryCatch(Promise.resolve(ffmpegProcess.kill("SIGTERM"))).then((result) => {
      if (result.error) {
        console.error("Error killing ffmpeg process:", result.error);
      }
    });
  }

  fileController.cleanupOutputFile();
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
  baseController.setIsRecording(false);
  baseController.setCurrentOutputFile(null); // Clear it to prevent race conditions
}

// Controller methods
const recordingController = {
  // Get the current recording status
  getStatus: () => {
    return baseController.getStatus();
  },

  // Start a new recording session
  startRecording: (req, res, io) => {
    if (baseController.getIsRecording()) {
      return res.status(400).send("Already recording");
    }

    tryCatch(
      (async () => {
        // Reset retry count for new recording
        baseController.setRetryCount(0);

        // Clean up any existing audio files first
        fileController.cleanupExistingAudioFiles();

        // Set up new recording environment
        fileController.setupRecordingEnvironment();

        // Start FFmpeg with options from the request
        const options = {
          duration: req.body.duration || 30,
          speechSpeed: req.body.speechSpeed || "normal",
        };

        startFFmpegProcess(io, options);
        baseController.setIsRecording(true);

        return true;
      })()
    ).then((result) => {
      if (result.error) {
        console.error("Error starting recording:", result.error);
        res
          .status(500)
          .send(`Error starting recording: ${result.error.message}`);
        cleanupRecordingResources();
      } else {
        res.status(200).send("Recording started");
      }
    });
  },

  // Cancel any ongoing recording
  cancelRecording: async (req, res, io) => {
    console.log("Cancelling current recording");

    const result = await tryCatch(
      (async () => {
        // If recording is in progress, stop it
        if (baseController.getIsRecording()) {
          console.log("Stopping active recording due to cancellation");
          await stopRecordingProcess();
          baseController.setIsRecording(false);
        }

        // Cleanup any current resources
        cleanupRecordingResources();

        return true;
      })()
    );

    if (result.error) {
      console.error("Error during recording cancellation:", result.error);
      io.emit("error", "Error during recording cancellation");
      res.status(500).send("Error during recording cancellation");
    } else {
      res.status(200).send("Recording cancelled");
    }
  },

  // Export these functions so they can be used by other controllers
  stopRecordingProcess,
  cleanupRecordingResources,
};

module.exports = recordingController;
