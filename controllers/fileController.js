const fs = require("fs");
const path = require("path");
const { cleanupAudioFiles } = require("../utils/ffmpeg");
const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");

/**
 * Set up the recording directory and prepare output file
 * @returns {string} The path to the new output file
 */
function setupRecordingEnvironment() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
  }

  // Generate unique output file name
  const outputFile = `audio/${Date.now()}.wav`;
  console.log(`Starting new recording to: ${outputFile}`);

  // Update the shared state
  baseController.setCurrentOutputFile(outputFile);

  return outputFile;
}

/**
 * Clean up any existing audio files before starting a new recording
 */
function cleanupExistingAudioFiles() {
  console.log("Cleaning up existing audio files before starting new recording");
  // Delete all audio files in the audio directory
  const audioDir = path.join(__dirname, "..", "audio");
  cleanupAudioFiles(audioDir);

  // Also clean up the last processed file reference
  baseController.setLastProcessedFile(null);

  // Do NOT reset lastQuestion here - we want to maintain context between recordings
  // This allows for follow-up questions across different recording sessions
}

/**
 * Clean up the output file if it was created
 */
function cleanupOutputFile() {
  const currentOutputFile = baseController.getCurrentOutputFile();

  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    const deleteResult = tryCatch(
      Promise.resolve(fs.unlinkSync(currentOutputFile))
    );

    deleteResult.then((result) => {
      if (result.error) {
        console.error("Error deleting file:", result.error);
      } else {
        console.log(`Deleted audio file: ${currentOutputFile}`);
        baseController.setCurrentOutputFile(null);
      }
    });
  }
}

/**
 * Clean up empty output file
 */
function cleanupEmptyOutputFile() {
  const currentOutputFile = baseController.getCurrentOutputFile();

  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    const stats = fs.statSync(currentOutputFile);
    if (stats.size === 0) {
      // No data was recorded, so delete the file
      fs.unlinkSync(currentOutputFile);
      console.log(`Deleted empty audio file: ${currentOutputFile}`);
    }
  }
}

/**
 * Validate that the audio file exists and has content
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<void>}
 */
async function validateAudioFile(filePath) {
  // File validation
  if (!filePath) {
    console.error("No recording file was provided");
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

/**
 * Wait for file to have content
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<void>}
 */
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

module.exports = {
  setupRecordingEnvironment,
  cleanupExistingAudioFiles,
  cleanupOutputFile,
  cleanupEmptyOutputFile,
  validateAudioFile,
  waitForFileContent,
};
