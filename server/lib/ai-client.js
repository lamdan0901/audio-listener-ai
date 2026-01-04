/**
 * AI client module that handles initialization of various AI services
 * This is a generic, reusable component that could be used in multiple projects
 */

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

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
 * @param {string} [config.modelName] - Optional name of the model to use
 * @param {boolean} [config.withSafetySettings] - Whether to include safety settings
 * @returns {Object} - Configured Gemini model instance
 */
function getGeminiModel(genAI, config = {}) {
  const { modelName, withSafetySettings = false } = config;

  // Allow callers to pass null/undefined/empty modelName and still get the default
  const effectiveModelName =
    typeof modelName === "string" && modelName.trim().length > 0
      ? modelName
      : "gemini-3-flash-preview";

  const modelConfig = {
    model: effectiveModelName,
    generationConfig: {
      // Options: "minimal", "low", "medium", "high"
      thinkingConfig: {
        thinkingLevel: "minimal", // Use this to effectively disable reasoning
        includeThoughts: false, // Set to true if you want to see the reasoning text
      },
    },
  };

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
  createGenAIClient,
  getGeminiModel,
};
