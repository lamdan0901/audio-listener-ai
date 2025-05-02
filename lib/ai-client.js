/**
 * AI client module that handles initialization of various AI services
 * This is a generic, reusable component that could be used in multiple projects
 */

const { AssemblyAI } = require("assemblyai");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

/**
 * Initialize and configure AssemblyAI client
 * @returns {AssemblyAI} - Configured AssemblyAI client
 */
function createSpeechClient() {
  if (!process.env.ASSEMBLY_AI_API_KEY) {
    throw new Error("API key is required for AssemblyAI");
  }
  return new AssemblyAI({
    apiKey: process.env.ASSEMBLY_AI_API_KEY,
  });
}

/**
 * Initialize and configure Google Generative AI client
 * @param {string} apiKey - API key for Google Generative AI
 * @returns {GoogleGenerativeAI} - Configured generative AI client
 */
function createGenAIClient(apiKey) {
  if (!apiKey) {
    throw new Error("API key is required for Google Generative AI");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get a configured Gemini model with appropriate safety settings
 * @param {GoogleGenerativeAI} genAI - The Google Generative AI client
 * @param {Object} config - Configuration options
 * @param {string} config.modelName - Name of the model to use (default: "gemini-2.0-flash-001")
 * @param {boolean} config.withSafetySettings - Whether to include safety settings
 * @returns {Object} - Configured Gemini model instance
 */
function getGeminiModel(genAI, config = {}) {
  const { modelName = "gemini-2.0-flash-001", withSafetySettings = false } =
    config;

  const modelConfig = { model: modelName };

  if (withSafetySettings) {
    modelConfig.safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];
  }

  return genAI.getGenerativeModel(modelConfig);
}

module.exports = {
  createSpeechClient,
  createGenAIClient,
  getGeminiModel,
};
