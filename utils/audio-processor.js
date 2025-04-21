const fs = require("fs");
const path = require("path");
const { tryCatch } = require("../lib/tryCatch");
const { createSpeechClient } = require("../lib/ai-client");

// Initialize Google client
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
 * Transcribe audio file using Google Speech-to-Text
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
      const audioData = validateAndReadAudioFile(filePath);
      const audioBytes = audioData.toString("base64");

      console.log(
        `Attempting transcription for file size: ${audioBytes.length} bytes`
      );

      if (audioBytes.length < 100) {
        // Extremely small base64 data
        throw new Error(
          "Audio file contains insufficient data for transcription"
        );
      }

      // Set up speech recognition config based on speech speed
      const speechSpeed = options.speechSpeed || "normal";
      const isRetryAttempt = options.retryAttempt || false;
      const attemptNumber = options.attemptNumber || 0;
      console.log(
        `Using speech speed setting: ${speechSpeed}, Retry attempt: ${isRetryAttempt}, Attempt #: ${attemptNumber}`
      );

      // Configure speech recognition based on our settings
      const speechConfig = {
        encoding: "LINEAR16",
        sampleRateHertz: speechSpeed === "fast" ? 32000 : 16000,
        enableAutomaticPunctuation: true,
        languageCode,
        useEnhanced: true, // Use enhanced model for better results
        enableWordTimeOffsets: true, // Add word time offsets to help with segmentation
        maxAlternatives: 1, // We only need the top alternative
        enableSeparateRecognitionPerChannel: false,
        diarizationConfig: {
          enableSpeakerDiarization: false,
        },
        model: "latest_long", // Use the latest long model which is better for multi-utterance
      };

      // Apply very different settings based on retry attempt to get varied results
      if (isRetryAttempt) {
        console.log(
          `Retry attempt #${attemptNumber} - Using different strategy`
        );

        // If useSimpleSettings flag is set, use minimal configuration to avoid API errors
        if (options.useSimpleSettings) {
          console.log(
            "Using simplified speech recognition settings to avoid API errors"
          );
          // Override with the most basic settings that won't cause API issues
          speechConfig.model = "default";
          speechConfig.useEnhanced = false;

          // Remove any advanced settings that might cause API errors
          delete speechConfig.enableWordConfidence;
          delete speechConfig.enableSpokenPunctuation;

          console.log(
            "Using simple speech config:",
            JSON.stringify(speechConfig)
          );
        }
        // Use different models and settings for different retry attempts
        else if (attemptNumber % 3 === 0) {
          // Strategy 1: Use phone call model (good for lower quality audio)
          speechConfig.model = "phone_call";
          speechConfig.useEnhanced = true;
          speechConfig.audioChannelCount = 1;
          console.log(
            "Retry strategy: Using phone_call model for potentially noisy audio"
          );
        } else if (attemptNumber % 3 === 1) {
          // Strategy 2: Try video model with different settings
          speechConfig.model = "video";
          speechConfig.enableAutomaticPunctuation = true;
          speechConfig.enableWordTimeOffsets = true;
          speechConfig.useEnhanced = true;
          // Add speech adaptation with higher boost
          speechConfig.speechContexts = [
            {
              phrases: [],
              boost: 20, // Very high boost
            },
          ];
          console.log("Retry strategy: Using video model with high boost");
        } else {
          // Strategy 3: Use command and search model which is good for short phrases
          speechConfig.model = "command_and_search";
          speechConfig.useEnhanced = true;
          console.log("Retry strategy: Using command_and_search model");
        }
      }
      // Set model based on retry status
      else if (isRetryAttempt) {
        // If this is a retry attempt, use more advanced models
        speechConfig.model = options.model || "latest_long"; // Use a more accurate model
        speechConfig.useEnhanced = true;

        // Use more aggressive settings for retry attempts
        speechConfig.enableAutomaticPunctuation = true;
        speechConfig.enableWordConfidence = true;

        // Fix: enableSpokenPunctuation expects a boolean, not just an existence of the property
        if (
          speechConfig.model === "latest_long" ||
          speechConfig.model === "video"
        ) {
          speechConfig.enableSpokenPunctuation = true;
        }

        console.log("Using enhanced transcription settings for retry attempt");
      } else {
        // Use standard model for initial attempts
        speechConfig.model = "default";
      }

      // Add speech adaptation for different speech speeds
      if (speechSpeed === "fast" && !isRetryAttempt) {
        speechConfig.speechContexts = [
          {
            phrases: [], // Could add domain-specific terms here
            boost: isRetryAttempt ? 15 : 10, // Higher boost on retry
          },
        ];
      } else if (speechSpeed === "slow" && !isRetryAttempt) {
        // For slow speech, we can use more conservative settings
        speechConfig.enableWordTimeOffsets = true; // Get word timestamps
      }

      console.log(`Using speech model: ${speechConfig.model}`);

      const [response] = await speechClient.recognize({
        config: speechConfig,
        audio: { content: audioBytes },
      });

      const transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join("\n");

      console.log(`Transcription successful with model: ${speechConfig.model}`);
      return transcription;
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

      // Every other attempt, we'll try simplified settings to avoid API errors
      if ((newOptions.attemptNumber || 1) % 2 === 0) {
        newOptions.useSimpleSettings = true;
      }

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
