const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");
const { cleanupAudioFiles } = require("./audio-processor");

/**
 * Get FFmpeg command arguments based on platform
 */
function getFfmpegArgs(outputFile, options = {}) {
  const args = ["-y", "-hide_banner"];
  // Default options with fallbacks
  const settings = {
    duration: options.duration || 90,
    speechSpeed: options.speechSpeed || "normal",
  };

  console.log(
    `Recording settings: Duration=${settings.duration}s, Speed=${settings.speechSpeed}`
  );

  if (process.platform === "win32") {
    // On Windows, use a more reliable approach
    // Set higher log level to help with debugging
    args.push("-loglevel", "info");

    // Try to use virtual-audio-capturer which is common for system audio
    console.log("Attempting to use Windows virtual-audio-capturer");
    args.push(
      "-f",
      "dshow",
      "-rtbufsize",
      "100M", // Use a larger buffer for more reliability
      "-i",
      "audio=virtual-audio-capturer",
      "-sample_rate",
      "16000",
      "-channels",
      "1"
    );
  } else if (process.platform === "linux") {
    args.push("-loglevel", "error");
    args.push("-f", "pulse", "-i", "default");
  } else {
    args.push("-loglevel", "error");
    throw new Error("Unsupported platform");
  }

  // Adjust audio settings based on speech speed
  if (settings.speechSpeed === "slow") {
    // For slow speech: higher quality, standard settings
    args.push(
      "-ac",
      "1",
      "-ar",
      "16000",
      "-acodec",
      "pcm_s16le",
      "-t",
      settings.duration.toString(),
      outputFile
    );
  } else if (settings.speechSpeed === "fast") {
    // For fast speech: higher sample rate to capture more detail
    args.push(
      "-ac",
      "1",
      "-ar",
      "32000", // Higher sample rate for faster speech
      "-acodec",
      "pcm_s16le",
      "-t",
      settings.duration.toString(),
      outputFile
    );
  } else {
    // Normal speech (default)
    args.push(
      "-ac",
      "1",
      "-ar",
      "16000",
      "-acodec",
      "pcm_s16le",
      "-t",
      settings.duration.toString(),
      outputFile
    );
  }

  return args;
}

/**
 * Check if FFmpeg is available in the system
 */
function checkFFmpegAvailability() {
  return tryCatch(
    new Promise((resolve, reject) => {
      const result = spawn("ffmpeg", ["-version"]);

      result.on("error", (err) => {
        console.error("FFmpeg not available:", err.message);
        console.error(
          "Please ensure FFmpeg is installed and available in your PATH"
        );
        process.exit(1);
      });

      result.stderr.on("data", (data) => {
        console.error(`FFmpeg check stderr: ${data}`);
      });

      result.stdout.on("data", (data) => {
        console.log(`FFmpeg available: ${data.toString().split("\n")[0]}`);
        resolve(true);
      });

      result.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg check exited with code ${code}`));
        }
      });
    })
  ).then((result) => {
    if (result.error) {
      console.error("FFmpeg check failed:", result.error.message);
      console.error(
        "Please ensure FFmpeg is installed and available in your PATH"
      );
      process.exit(1);
    }
    return result.data;
  });
}

module.exports = {
  getFfmpegArgs,
  checkFFmpegAvailability,
  cleanupAudioFiles,
};
