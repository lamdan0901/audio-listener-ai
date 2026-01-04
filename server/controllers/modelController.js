/**
 * Controller for handling model-related requests
 */
const modelController = {
  /**
   * List available Gemini models
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  listModels: async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not set in the server environment.",
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Filter models that support generateContent, include "Gemini", and exclude versions 2.0 or less
      const supportedModels = data.models.filter((model) => {
        // Check if model supports generateContent
        if (!model.supportedGenerationMethods.includes("generateContent")) {
          return false;
        }

        // Check if model name includes "Gemini" (case-insensitive)
        if (!model.name.toLowerCase().includes("gemini")) {
          return false;
        }

        // Extract version number from model name (e.g., "gemini-1.5-pro" -> 1.5)
        const versionMatch = model.name.match(/gemini[/-](\d+(\.\d+)?)/i);
        if (versionMatch) {
          const version = parseFloat(versionMatch[1]);
          // Exclude versions 2.0 or less
          if (version <= 2.0) {
            return false;
          }
        }

        return true;
      });

      res.json({
        models: supportedModels,
        nextPageToken: data.nextPageToken,
      });
    } catch (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({
        error: "Failed to fetch models",
        details: error.message,
      });
    }
  },
};

module.exports = modelController;
