const { tryCatch } = require("../lib/tryCatch");
const { transcribeAudio, processAudioGeneric } = require("./audio-processor");
const { createGenAIClient, getGeminiModel } = require("../lib/ai-client");

// Initialize Google AI client
const genAI = createGenAIClient(process.env.GEMINI_API_KEY);

/**
 * Gets context-specific prompt text based on the question context
 * @param {string} questionContext - Context category for the question
 * @param {boolean} isAudioFormat - Whether to use shorter format for audio processing
 * @returns {string} - The context-specific prompt text
 */
function getContextPrompt(questionContext = "general", isAudioFormat = false) {
  const contextMap = {
    "html/css/javascript": {
      standard:
        "Your answer should focus on HTML, CSS or Javascript concepts, best practices, and standards.",
      audio:
        "Focus on HTML, CSS or Javascript concepts, best practices, and standards.",
    },
    typescript: {
      standard:
        "Your answer should focus on TypeScript language concepts, features, type system, and best practices.",
      audio:
        "Focus on TypeScript language concepts, features, type system, and best practices.",
    },
    reactjs: {
      standard:
        "Your answer should focus on React.js concepts, components, hooks, and best practices.",
      audio:
        "Focus on React.js concepts, components, hooks, and best practices.",
    },
    nextjs: {
      standard:
        "Your answer should focus on Next.js framework concepts, features, and best practices.",
      audio:
        "Focus on Next.js framework concepts, features, and best practices.",
    },
    interview: {
      standard:
        "Your answer should be formatted as a concise interview response, highlighting key points clearly.",
      audio:
        "Format your response as a concise interview answer, highlighting key points clearly.",
    },
    general: {
      standard:
        "Your answer should focus on general frontend development concepts and best practices.",
      audio:
        "Focus on general frontend development concepts and best practices.",
    },
  };

  const format = isAudioFormat ? "audio" : "standard";
  return (contextMap[questionContext] || contextMap.general)[format];
}

/**
 * Builds a complete prompt for Gemini based on inputs
 * @param {string} question - The question to answer
 * @param {string} lang - Language code (e.g., 'en' or 'vi')
 * @param {string} contextPrompt - Context-specific prompt
 * @param {string} previousQuestion - Previous question for follow-ups
 * @param {string} customContext - Custom context provided by user
 * @returns {string} - Complete prompt
 */
function buildPrompt(
  question,
  lang,
  contextPrompt,
  previousQuestion = null,
  customContext = ""
) {
  // Add previous question context if this is a follow-up
  let followUpContext = "";
  if (previousQuestion) {
    followUpContext = `This is a follow-up question. Previous question was: "${previousQuestion}". `;
  }

  // Add custom context if provided
  let userCustomContext = "";
  if (customContext && customContext.trim() !== "") {
    userCustomContext = `${customContext.trim()} `;
  }

  // Base completion text
  const completionText = `Answer the following question concisely using Markdown formatting for better readability: ${question}. Use headings, lists, and code blocks where appropriate.`;

  // Build final prompt based on language
  if (lang === "vi") {
    return `Question will be in Vietnamese and answer must be in Vietnamese. ${contextPrompt} ${followUpContext}${userCustomContext}${completionText}`;
  } else {
    return `${contextPrompt} ${followUpContext}${userCustomContext}${completionText}`;
  }
}

/**
 * Gets Gemini model instance with appropriate configuration
 * @param {boolean} withSafetySettings - Whether to include safety settings
 * @returns {Object} - Configured Gemini model instance
 */
function getConfiguredGeminiModel(withSafetySettings = false) {
  return getGeminiModel(genAI, { withSafetySettings });
}

/**
 * Generate answer using Gemini API
 */
async function generateAnswer(
  question,
  lang,
  questionContext = "general",
  previousQuestion = null,
  streaming = false,
  customContext = ""
) {
  const model = getConfiguredGeminiModel();
  const contextPrompt = getContextPrompt(questionContext);
  const prompt = buildPrompt(
    question,
    lang,
    contextPrompt,
    previousQuestion,
    customContext
  );

  const result = await tryCatch(model.generateContent(prompt));

  if (result.error) {
    console.error("Error generating answer:", result.error);
    throw result.error;
  }

  return result.data.response.text();
}

/**
 * Stream generated answer using Gemini API
 */
async function* streamGeneratedAnswer(
  question,
  lang,
  questionContext = "general",
  previousQuestion = null,
  customContext = ""
) {
  const model = getConfiguredGeminiModel();
  const contextPrompt = getContextPrompt(questionContext);
  const prompt = buildPrompt(
    question,
    lang,
    contextPrompt,
    previousQuestion,
    customContext
  );

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
  questionContext = "general",
  customContext = ""
) {
  return processAudioGeneric(filePath, async (audioBase64) => {
    console.log(`Processing audio directly with Gemini: ${filePath}`);

    // Get the appropriate model with safety settings
    const model = getConfiguredGeminiModel(true);

    // Create parts array with the audio content
    const parts = [
      {
        inlineData: {
          data: audioBase64,
          mimeType: "audio/wav",
        },
      },
    ];

    // Get context-specific prompt with audio format
    const contextPrompt = getContextPrompt(questionContext, true);

    // Add custom context if provided
    let userCustomContext = "";
    if (customContext && customContext.trim() !== "") {
      userCustomContext = `${customContext.trim()} `;
    }

    // Add prompt text based on language
    let promptText = "";
    if (lang === "vi") {
      promptText = `Đây là nội dung âm thanh. ${contextPrompt} ${userCustomContext}
      QUAN TRỌNG: Nếu có nhiều câu hỏi trong đoạn âm thanh, bạn PHẢI trả lời tất cả các câu hỏi theo thứ tự. Bạn PHẢI nêu rõ từng câu hỏi bằng cách viết "Câu hỏi 1: [nội dung câu hỏi]" trước khi trả lời. Nếu có nhiều câu hỏi, bạn phải liệt kê chúng theo định dạng "Câu hỏi 1: ...", "Câu hỏi 2: ...", v.v.
      Sử dụng định dạng Markdown cho câu trả lời của bạn.`;
      parts.push({ text: promptText });
    } else {
      promptText = `This is audio content. ${contextPrompt} ${userCustomContext}
      IMPORTANT: If there are multiple questions in the audio, you MUST respond to ALL of them in order. You MUST clearly identify each question by writing "Question 1: [question content]" before answering it. If there are multiple questions, you must list them in the format "Question 1: ...", "Question 2: ...", etc.
      Use Markdown formatting for better readability in your answers.`;
      parts.push({ text: promptText });
    }

    console.log("Sending audio to Gemini for direct processing");
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const responseText = result.response.text();

    // For direct Gemini processing, we'll extract both the transcript and the answer
    // from the response, as Gemini will both transcribe and answer
    let transcript = "";
    let answer = responseText;

    // Try to extract questions - look for patterns that indicate multiple questions
    const questionsPattern =
      /(?:Question|Câu hỏi)\s*\d+\s*:\s*(.*?)(?=(?:Question|Câu hỏi)\s*\d+|[\n\r]|$)/gi;
    const questionsMatches = [...responseText.matchAll(questionsPattern)];

    if (questionsMatches.length > 0) {
      // Multiple questions found, combine them
      transcript = questionsMatches.map((match) => match[1].trim()).join(" | ");
      console.log(
        "Extracted multiple questions from Gemini response:",
        transcript
      );
    } else {
      // Try alternative patterns if the specific format wasn't found
      const altPattern = /[""']([^""'\n]{5,})[""'](?:\?|\.)/g;
      const altMatches = [...responseText.matchAll(altPattern)];

      if (altMatches.length > 0) {
        transcript = altMatches.map((match) => match[1].trim()).join(" | ");
        console.log(
          "Extracted questions using alternative pattern:",
          transcript
        );
      } else {
        // Try the "I heard you ask" pattern
        const heardPattern =
          /(?:I heard you ask|You asked)(?:[:\s]+)["']?([^"'\n.?]{5,}\??)['"]/gi;
        const heardMatches = [...responseText.matchAll(heardPattern)];

        if (heardMatches.length > 0) {
          transcript = heardMatches.map((match) => match[1].trim()).join(" | ");
          console.log(
            "Extracted questions using 'heard you ask' pattern:",
            transcript
          );
        } else {
          // Try the simplest pattern - just looking for question mark
          const simplePattern = /([^.!?\n]{10,}\?)/g;
          const simpleMatches = [...responseText.matchAll(simplePattern)];

          if (simpleMatches.length > 0) {
            transcript = simpleMatches
              .map((match) => match[1].trim())
              .join(" | ");
            console.log(
              "Extracted questions using simple pattern:",
              transcript
            );
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
        }
      }
    }

    return { transcript, answer };
  });
}

module.exports = {
  transcribeAudio,
  generateAnswer,
  streamGeneratedAnswer,
  processAudioWithGemini,
};
