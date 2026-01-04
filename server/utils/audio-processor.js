const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");

// Create a promise with timeout function
function promiseWithTimeout(promise, timeoutMs, errorMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`)
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutId)
  );
}

/**
 * Validates audio file existence and checks for potential issues
 * @param {string} filePath - Path to the audio file
 * @returns {Buffer} - The audio file data
 * @throws {Error} - If file doesn't exist or has issues
 */
function validateAndReadAudioFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Audio file not found");
  }

  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error("Audio file is empty");
  }

  if (fileStats.size < 1000) {
    // If file is suspiciously small (less than 1KB)
    console.warn(`Warning: Audio file is very small (${fileStats.size} bytes)`);
  }

  return fs.readFileSync(filePath);
}

/**
 * Process audio directly with a model
 * This is a structure function that helps with audio processing
 *
 * @param {string} filePath - Path to the audio file
 * @param {Function} processingFunction - Function to process the audio bytes
 * @returns {Promise<Object>} - Results from the processing function
 */
async function processAudioGeneric(filePath, processingFunction) {
  const result = await tryCatch(
    (async () => {
      console.log(`Processing audio generically: ${filePath}`);

      // Validate and read audio file
      const audioData = validateAndReadAudioFile(filePath);

      // Convert audio to base64
      const audioBase64 = audioData.toString("base64");

      // Call the processing function with the audio data
      return processingFunction(audioBase64, audioData);
    })()
  );

  if (result.error) {
    console.error("Error processing audio:", result.error);
    throw result.error;
  }

  return result.data;
}

/**
 * Delete any temporary audio files
 */
async function cleanupAudioFiles(audioDir) {
  if (fs.existsSync(audioDir)) {
    const readResult = await tryCatch(
      Promise.resolve(fs.readdirSync(audioDir))
    );

    if (readResult.error) {
      console.error("Failed to read audio directory:", readResult.error);
      return;
    }

    const files = readResult.data;
    for (const file of files) {
      const deleteResult = await tryCatch(
        Promise.resolve(fs.unlinkSync(path.join(audioDir, file)))
      );

      if (deleteResult.error) {
        console.error(`Failed to delete file ${file}:`, deleteResult.error);
      }
    }

    console.log("Temporary audio files cleaned up");
  }
}

module.exports = {
  validateAndReadAudioFile,
  processAudioGeneric,
  cleanupAudioFiles,
};
