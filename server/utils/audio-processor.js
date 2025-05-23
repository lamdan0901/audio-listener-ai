const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");
const { createSpeechClient } = require("../lib/ai-client");

// Initialize AssemblyAI client
let speechClient;
try {
  speechClient = createSpeechClient();
  console.log("AssemblyAI client initialized successfully");
} catch (error) {
  console.error("Failed to initialize AssemblyAI client:", error.message);
  // We'll handle this error when transcription is attempted
}

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
 * Transcribe audio file using AssemblyAI
 * @param {string} filePath - Path to the audio file
 * @param {string} languageCode - Language code for transcription
 * @param {Object} options - Additional options for transcription
 * @param {number} retries - Number of retries if transcription fails
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(
  filePath,
  languageCode,
  options = {},
  retries = 3
) {
  // Check if AssemblyAI client was initialized successfully
  if (!speechClient) {
    const error = new Error(
      "AssemblyAI client is not initialized. Check your API key and network connection."
    );
    console.error(error.message);

    // If we have retries left, wait a bit and try again (might be a temporary issue)
    if (retries > 0) {
      console.log(
        `Retrying client initialization (${retries} attempts left)...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      try {
        speechClient = createSpeechClient();
        console.log("AssemblyAI client initialized successfully on retry");
      } catch (initError) {
        console.error(
          "Failed to initialize AssemblyAI client on retry:",
          initError.message
        );
      }

      return transcribeAudio(filePath, languageCode, options, retries - 1);
    }

    throw error;
  }

  const result = await tryCatch(
    (async () => {
      // Validate and read audio file
      try {
        validateAndReadAudioFile(filePath);
      } catch (fileError) {
        console.error(`File validation error: ${fileError.message}`);
        throw fileError; // Re-throw to be caught by tryCatch
      }

      console.log(`Attempting transcription for file: ${filePath}`);
      console.log(`File size: ${fs.statSync(filePath).size} bytes`);
      console.log(`File path: ${path.resolve(filePath)}`);

      // Set up speech recognition config
      const isRetryAttempt = options.retryAttempt || false;
      const attemptNumber = options.attemptNumber || 0;
      console.log(
        `Retry attempt: ${isRetryAttempt}, Attempt #: ${attemptNumber}`
      );

      // Read the file as a buffer
      const audioBuffer = fs.readFileSync(filePath);
      console.log(
        `Read audio file into buffer, size: ${audioBuffer.length} bytes`
      );

      // Get file extension
      const ext = path.extname(filePath).toLowerCase();
      console.log(`File extension: ${ext}`);

      // Configure AssemblyAI transcription parameters
      // Determine which speech model to use
      let speechModel = "universal";

      // Apply different models based on retry attempt to get varied results
      if (isRetryAttempt) {
        console.log(
          `Retry attempt #${attemptNumber} - Using different strategy`
        );

        // Different strategies for different retry attempts
        if (attemptNumber % 3 === 0) {
          // Strategy 1: Use the best model with higher quality
          speechModel = "best";
          console.log("Retry strategy: Using best model with high quality");
        } else if (attemptNumber % 3 === 1) {
          // Strategy 2: Try the universal model
          speechModel = "universal";
          console.log("Retry strategy: Using universal model");
        } else {
          // Strategy 3: Try the nano model with text formatting
          speechModel = "nano";
          console.log("Retry strategy: Using nano model with text formatting");
        }
      } else {
        // Use universal model for initial attempts (best general-purpose model)
        speechModel = "universal";
      }

      console.log(`Using speech model: ${speechModel}`);
      console.log("Sending request to AssemblyAI...");

      try {
        // First, upload the audio file
        console.log("Uploading audio file to AssemblyAI...");
        const uploadResponse = await speechClient.files.upload(audioBuffer);
        console.log("Upload successful:", uploadResponse);

        // Create transcription parameters
        const transcriptionParams = {
          audio_url: uploadResponse,
          speech_model: speechModel,
        };

        // Set language code if provided
        if (languageCode) {
          transcriptionParams.language_code = languageCode;
        }

        // Log the parameters we're sending to AssemblyAI
        console.log("AssemblyAI parameters:", {
          ...transcriptionParams,
          audio_url: uploadResponse,
        });

        // Execute the transcription with a timeout
        console.log("Sending transcription request to AssemblyAI...");

        // Submit the transcription request
        const transcriptionPromise =
          speechClient.transcripts.transcribe(transcriptionParams);

        // Get the initial transcription response
        const transcriptionResponse = await promiseWithTimeout(
          transcriptionPromise,
          60000, // 60 second timeout
          "AssemblyAI transcription request timed out after 60 seconds"
        );

        console.log("Received initial response from AssemblyAI.");

        // Wait for the transcription to complete
        console.log("Waiting for transcription to complete...");
        const transcript = await speechClient.transcripts.waitUntilReady(
          transcriptionResponse.id,
          {
            pollingInterval: 3000, // Poll every 3 seconds
          }
        );

        console.log("Transcription completed!");
        console.log(
          "Received final transcript from AssemblyAI:",
          transcript.text
        );

        console.log(`Transcription successful with model: ${speechModel}`);

        if (!transcript || !transcript.text) {
          console.warn("Warning: Received empty transcript from AssemblyAI");
          return ""; // Return empty string instead of null/undefined
        }

        return transcript.text;
      } catch (transcriptionError) {
        console.error(
          `AssemblyAI transcription error: ${transcriptionError.message}`
        );

        // Add more detailed error information
        if (transcriptionError.message.includes("timed out")) {
          console.error(
            "The request to AssemblyAI timed out. This could be due to network issues or service problems."
          );
        } else if (transcriptionError.message.includes("401")) {
          console.error(
            "Authentication error with AssemblyAI. Check your API key."
          );
        } else if (transcriptionError.message.includes("429")) {
          console.error(
            "Rate limit exceeded with AssemblyAI. You may need to upgrade your plan or wait before trying again."
          );
        }

        throw transcriptionError; // Re-throw to be caught by tryCatch
      }
    })()
  );

  if (result.error) {
    console.error("Error in transcription:", result.error);

    // Implement a fallback mechanism for empty or failed transcriptions
    if (
      result.error.message.includes("timed out") ||
      result.error.message.includes("network") ||
      result.error.message.includes("empty")
    ) {
      console.log("Using fallback mechanism for failed transcription");

      // If this is a retry with a different model, we might want to try yet another approach
      if (retries > 0) {
        console.log(`Retrying transcription (${retries} attempts left)...`);

        // Try again with different settings
        const newOptions = {
          ...options,
          retryAttempt: true,
          attemptNumber: (options.attemptNumber || 0) + 1,
        };

        // Wait a bit before retrying to avoid overwhelming the service
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return transcribeAudio(filePath, languageCode, newOptions, retries - 1);
      }

      // If we're out of retries, return a placeholder message
      console.log("Out of retries, returning placeholder message");
      return ""; // Return empty string to indicate no transcription was possible
    }

    // For other types of errors, retry if we have attempts left
    if (retries > 0) {
      console.log(`Retrying transcription (${retries} attempts left)...`);

      // Try again with different settings
      const newOptions = {
        ...options,
        retryAttempt: true,
        attemptNumber: (options.attemptNumber || 0) + 1,
      };

      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
