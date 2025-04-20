const fs = require("fs");
const speech = require("@google-cloud/speech");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

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
      console.log(`Retry attempt #${attemptNumber} - Using different strategy`);

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

    // Concatenate all results instead of just taking the first one
    // This ensures we capture all questions/utterances in the audio
    let transcript = "";
    response.results.forEach((result, index) => {
      if (result.alternatives && result.alternatives.length > 0) {
        const segmentText = result.alternatives[0].transcript;
        transcript += (index > 0 ? " " : "") + segmentText;
        console.log(`Speech segment ${index + 1}:`, segmentText);
      }
    });

    console.log("Final concatenated transcription:", transcript);
    return transcript;
  } catch (error) {
    console.error("Transcription attempt failed:", error.message);
    if (retries > 0) {
      console.log(`Retrying transcription (${retries} attempts left)...`);

      // Modify options for retry
      const retryOptions = {
        ...options,
        retryAttempt: true, // Mark as a retry attempt
        attemptNumber: (options.attemptNumber || 0) + 1, // Increment attempt counter
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));
      return transcribeAudio(filePath, languageCode, retryOptions, retries - 1);
    }
    throw error;
  }
}

/**
 * Generate answer using Gemini model
 */
async function generateAnswer(
  question,
  lang,
  questionContext = "general",
  previousQuestion = null,
  streaming = false
) {
  if (streaming) {
    return streamGeneratedAnswer(
      question,
      lang,
      questionContext,
      previousQuestion
    );
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  let prompt;

  // Create context-specific prompt additions
  let contextPrompt = "";
  switch (questionContext) {
    case "html":
      contextPrompt =
        "Your answer should focus on HTML concepts, best practices, and standards.";
      break;
    case "css":
      contextPrompt =
        "Your answer should focus on CSS concepts, styling techniques, and best practices.";
      break;
    case "javascript":
      contextPrompt =
        "Your answer should focus on JavaScript language concepts, features, and best practices.";
      break;
    case "typescript":
      contextPrompt =
        "Your answer should focus on TypeScript language concepts, features, type system, and best practices.";
      break;
    case "reactjs":
      contextPrompt =
        "Your answer should focus on React.js concepts, components, hooks, and best practices.";
      break;
    case "nextjs":
      contextPrompt =
        "Your answer should focus on Next.js framework concepts, features, and best practices.";
      break;
    case "interview":
      contextPrompt =
        "Your answer should be formatted as a concise interview response, highlighting key points clearly.";
      break;
    default:
      contextPrompt =
        "Your answer should focus on general frontend development concepts and best practices.";
  }

  // Add previous question context if this is a follow-up
  let followUpContext = "";
  if (previousQuestion) {
    followUpContext = `This is a follow-up question. Previous question was: "${previousQuestion}". `;
  }

  if (lang === "vi") {
    prompt =
      `Question will be in Vietnamese and answer must be in Vietnamese. ` +
      `${contextPrompt} ` +
      `${followUpContext}` +
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  } else {
    prompt =
      `${contextPrompt} ` +
      `${followUpContext}` +
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Stream generated answer using Gemini model
 */
async function* streamGeneratedAnswer(
  question,
  lang,
  questionContext = "general",
  previousQuestion = null
) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  let prompt;

  // Create context-specific prompt additions
  let contextPrompt = "";
  switch (questionContext) {
    case "html":
      contextPrompt =
        "Your answer should focus on HTML concepts, best practices, and standards.";
      break;
    case "css":
      contextPrompt =
        "Your answer should focus on CSS concepts, styling techniques, and best practices.";
      break;
    case "javascript":
      contextPrompt =
        "Your answer should focus on JavaScript language concepts, features, and best practices.";
      break;
    case "typescript":
      contextPrompt =
        "Your answer should focus on TypeScript language concepts, features, type system, and best practices.";
      break;
    case "reactjs":
      contextPrompt =
        "Your answer should focus on React.js concepts, components, hooks, and best practices.";
      break;
    case "nextjs":
      contextPrompt =
        "Your answer should focus on Next.js framework concepts, features, and best practices.";
      break;
    case "interview":
      contextPrompt =
        "Your answer should be formatted as a concise interview response, highlighting key points clearly.";
      break;
    default:
      contextPrompt =
        "Your answer should focus on general frontend development concepts and best practices.";
  }

  // Add previous question context if this is a follow-up
  let followUpContext = "";
  if (previousQuestion) {
    followUpContext = `This is a follow-up question. Previous question was: "${previousQuestion}". `;
  }

  if (lang === "vi") {
    prompt =
      `Question will be in Vietnamese and answer must be in Vietnamese. ` +
      `${contextPrompt} ` +
      `${followUpContext}` +
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  } else {
    prompt =
      `${contextPrompt} ` +
      `${followUpContext}` +
      `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
      `Use headings, lists, and code blocks where appropriate.`;
  }

  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) yield chunkText;
  }
}

/**
 * Process audio directly with Gemini API
 * This bypasses the Speech-to-Text step and sends audio directly to Gemini
 */
async function processAudioWithGemini(
  filePath,
  lang = "en",
  questionContext = "general"
) {
  try {
    console.log(`Processing audio directly with Gemini: ${filePath}`);

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error("Audio file not found");
    }

    // Read the audio file as binary data
    const audioData = fs.readFileSync(filePath);

    // Get the appropriate model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Convert audio to base64
    const audioBase64 = audioData.toString("base64");

    // Create parts array with the audio content
    const parts = [
      {
        inlineData: {
          data: audioBase64,
          mimeType: "audio/wav",
        },
      },
    ];

    // Create context-specific prompt additions
    let contextPrompt = "";
    switch (questionContext) {
      case "html":
        contextPrompt =
          "Focus on HTML concepts, best practices, and standards.";
        break;
      case "css":
        contextPrompt =
          "Focus on CSS concepts, styling techniques, and best practices.";
        break;
      case "javascript":
        contextPrompt =
          "Focus on JavaScript language concepts, features, and best practices.";
        break;
      case "typescript":
        contextPrompt =
          "Focus on TypeScript language concepts, features, type system, and best practices.";
        break;
      case "reactjs":
        contextPrompt =
          "Focus on React.js concepts, components, hooks, and best practices.";
        break;
      case "nextjs":
        contextPrompt =
          "Focus on Next.js framework concepts, features, and best practices.";
        break;
      case "interview":
        contextPrompt =
          "Format your response as a concise interview answer, highlighting key points clearly.";
        break;
      default:
        contextPrompt =
          "Focus on general frontend development concepts and best practices.";
    }

    // Add prompt text based on language
    let promptText = "";
    if (lang === "vi") {
      promptText = `Đây là nội dung âm thanh. ${contextPrompt} Hãy trả lời nội dung câu hỏi trong đoạn âm thanh một cách ngắn gọn và rõ ràng bằng tiếng Việt. Sử dụng định dạng Markdown cho câu trả lời.`;
      parts.push({ text: promptText });
    } else {
      promptText = `This is audio content. ${contextPrompt} Please respond to the question in the audio concisely and clearly. Use Markdown formatting for better readability.`;
      parts.push({ text: promptText });
    }

    console.log("Sending audio to Gemini for direct processing");
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    // Extract the transcript from the response
    const responseText = result.response.text();

    // For direct Gemini processing, we'll extract both the transcript and the answer
    // from the response, as Gemini will both transcribe and answer
    let transcript = "";
    let answer = responseText;

    // Try to extract the question/transcript from the response
    const transcriptMatch = responseText.match(
      /question[s]?:?\s*[""']?(.*?)[""']?[\n\r]/i
    );
    if (transcriptMatch && transcriptMatch[1]) {
      transcript = transcriptMatch[1].trim();
      console.log("Extracted transcript from Gemini response:", transcript);
    } else {
      // If we can't extract the specific question, use the first line or paragraph
      const firstLine = responseText.split(/[\n\r]/)[0];
      if (firstLine && firstLine.length < 200) {
        transcript = firstLine;
        console.log("Using first line as transcript:", transcript);
      } else {
        transcript = "Unable to extract specific question from audio";
      }
    }

    return { transcript, answer };
  } catch (error) {
    console.error("Error processing audio with Gemini:", error);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  generateAnswer,
  streamGeneratedAnswer,
  processAudioWithGemini,
};
