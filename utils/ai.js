const fs = require("fs");
const speech = require("@google-cloud/speech");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google clients
const speechClient = new speech.SpeechClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Transcribe audio file using Google Speech-to-Text
 */
async function transcribeAudio(
  filePath,
  languageCode,
  options = {},
  retries = 3
) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error("Audio file not found");
    }

    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      throw new Error("Audio file is empty");
    }

    if (fileStats.size < 1000) {
      // If file is suspiciously small (less than 1KB)
      console.warn(
        `Warning: Audio file is very small (${fileStats.size} bytes)`
      );
    }

    const audioBytes = fs.readFileSync(filePath).toString("base64");
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
    console.log(`Using speech speed setting: ${speechSpeed}`);

    const speechConfig = {
      encoding: "LINEAR16",
      sampleRateHertz: speechSpeed === "fast" ? 32000 : 16000,
      enableAutomaticPunctuation: true,
      languageCode,
      model: "default", // Use the best available model
      useEnhanced: true, // Use enhanced model for better results
    };

    // Add speech adaptation for different speech speeds
    if (speechSpeed === "fast") {
      speechConfig.speechContexts = [
        {
          phrases: [], // Could add domain-specific terms here
          boost: 10, // Boost recognition confidence
        },
      ];
    } else if (speechSpeed === "slow") {
      // For slow speech, we can use more conservative settings
      speechConfig.enableWordTimeOffsets = true; // Get word timestamps
    }

    const [response] = await speechClient.recognize({
      audio: { content: audioBytes },
      config: speechConfig,
    });

    if (!response.results?.length) {
      console.log(
        "No transcription results - response:",
        JSON.stringify(response, null, 2)
      );
      throw new Error("No speech detected in the audio");
    }

    const transcript = response.results[0].alternatives[0].transcript;
    console.log("Transcription successful:", transcript);
    return transcript;
  } catch (error) {
    console.error("Transcription attempt failed:", error.message);
    if (retries > 0) {
      console.log(`Retrying transcription (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return transcribeAudio(filePath, languageCode, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Generate answer using Gemini model
 */
async function generateAnswer(question, lang) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  let prompt;

  if (lang === "vi") {
    prompt =
      `Question will be in Vietnamese and answer must be in Vietnamese. ` +
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  } else {
    prompt =
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = {
  transcribeAudio,
  generateAnswer,
};
