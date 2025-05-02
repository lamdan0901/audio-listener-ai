const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");
const { createSpeechClient } = require("../lib/ai-client");

// Initialize AssemblyAI client
const speechClient = createSpeechClient();

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
 * Transcribe audio file using AssemblyAI
 */
async function transcribeAudio(
  filePath,
  languageCode,
  options = {},
  retries = 3
) {
  const result = await tryCatch(
    (async () => {
      // Validate and read audio file
      validateAndReadAudioFile(filePath);

      console.log(`Attempting transcription for file: ${filePath}`);

      // Set up speech recognition config
      const isRetryAttempt = options.retryAttempt || false;
      const attemptNumber = options.attemptNumber || 0;
      console.log(
        `Retry attempt: ${isRetryAttempt}, Attempt #: ${attemptNumber}`
      );

      // Configure AssemblyAI transcription parameters
      const params = {
        audio: filePath,
        language_code: languageCode,
      };

      // Apply different models based on retry attempt to get varied results
      if (isRetryAttempt) {
        console.log(
          `Retry attempt #${attemptNumber} - Using different strategy`
        );

        // Different strategies for different retry attempts
        if (attemptNumber % 3 === 0) {
          // Strategy 1: Use the standard model with higher quality
          params.speech_model = "standard";
          console.log("Retry strategy: Using standard model with high quality");
        } else if (attemptNumber % 3 === 1) {
          // Strategy 2: Try the universal model
          params.speech_model = "universal";
          console.log("Retry strategy: Using universal model");
        } else {
          // Strategy 3: Use the standard model with different settings
          params.speech_model = "standard";
          params.punctuate = true;
          params.format_text = true;
          console.log(
            "Retry strategy: Using standard model with text formatting"
          );
        }
      } else {
        // Use universal model for initial attempts (best general-purpose model)
        params.speech_model = "universal";
      }

      console.log(`Using speech model: ${params.speech_model}`);

      // Execute the transcription
      const transcript = await speechClient.transcripts.transcribe(params);

      console.log(
        `Transcription successful with model: ${params.speech_model}`
      );
      return transcript.text;
    })()
  );

  if (result.error) {
    console.error("Error in transcription:", result.error);

    if (retries > 0) {
      console.log(`Retrying transcription (${retries} attempts left)...`);

      // Try again with different settings
      const newOptions = {
        ...options,
        retryAttempt: true,
        attemptNumber: (options.attemptNumber || 0) + 1,
      };

      return transcribeAudio(filePath, languageCode, newOptions, retries - 1);
    }

    throw result.error;
  }

  return result.data;
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
  transcribeAudio,
  processAudioGeneric,
  cleanupAudioFiles,
};
