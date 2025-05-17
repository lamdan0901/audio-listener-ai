const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");
const { cleanupAudioFiles } = require("./audio-processor");

/**
 * Get FFmpeg command arguments for converting an audio file to the standard format
 * @param {string} inputFile - Path to the input audio file
 * @param {string} outputFile - Path to the output audio file
 * @param {Object} options - Additional options
 * @returns {Array} - FFmpeg command arguments
 */
function getConversionArgs(inputFile, outputFile, options = {}) {
  const args = ["-y", "-hide_banner", "-loglevel", "info"];

  // Add input file
  args.push("-i", inputFile);

  // Set standard audio settings with 16000 Hz sample rate for speech recognition
  args.push(
    "-ac",
    "1", // Mono audio
    "-ar",
    "16000", // 16kHz sample rate (standard for speech recognition)
    "-acodec",
    "pcm_s16le", // PCM 16-bit little-endian format
    outputFile
  );

  return args;
}

/**
 * Convert an uploaded audio file to the standard format for speech recognition
 * @param {string} inputFile - Path to the input audio file
 * @returns {Promise<string>} - Path to the converted audio file
 */
async function convertAudioToStandardFormat(inputFile) {
  // Generate output filename with .wav extension
  const outputFile = path.join(
    path.dirname(inputFile),
    `${path.basename(inputFile, path.extname(inputFile))}_converted.wav`
  );

  console.log(`Converting audio file: ${inputFile} -> ${outputFile}`);

  const args = getConversionArgs(inputFile, outputFile);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);

    ffmpeg.stderr.on("data", (data) => {
      // FFmpeg outputs progress information to stderr
      console.log(`FFmpeg: ${data.toString().trim()}`);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`Audio conversion successful: ${outputFile}`);
        resolve(outputFile);
      } else {
        reject(new Error(`FFmpeg conversion failed with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

/**
 * Check if FFmpeg is available in the system
 * @returns {Promise<boolean>} - True if FFmpeg is available
 */
async function checkFFmpegAvailability() {
  return new Promise((resolve, reject) => {
    const result = spawn("ffmpeg", ["-version"]);

    result.on("error", (err) => {
      console.warn("FFmpeg not available:", err.message);
      console.warn("Some audio format conversions may not work properly");
      reject(err);
    });

    result.stderr.on("data", (data) => {
      console.warn(`FFmpeg check stderr: ${data}`);
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
  });
}

/**
 * Determine if an audio file needs conversion based on its format
 * @param {string} filePath - Path to the audio file
 * @returns {boolean} - True if the file needs conversion
 */
function needsConversion(filePath) {
  // Get the file extension
  const ext = path.extname(filePath).toLowerCase();

  // List of formats that don't need conversion (already in optimal format)
  const optimalFormats = [".wav"];

  // Check if the file is already in an optimal format
  return !optimalFormats.includes(ext);
}

module.exports = {
  getConversionArgs,
  convertAudioToStandardFormat,
  checkFFmpegAvailability,
  cleanupAudioFiles,
  needsConversion,
};
