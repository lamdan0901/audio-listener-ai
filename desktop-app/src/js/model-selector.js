/**
 * Model Selector Component
 * Handles fetching and selecting Gemini models
 */

let selectedModel = null;

/**
 * Fetches the list of available models from the server
 * @returns {Promise<Array>} List of models
 */
async function fetchModels() {
  try {
    const apiUrl = window.electronAPI.getApiBaseUrl();
    const response = await fetch(`${apiUrl}/api/v1/models`);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/**
 * Renders the model selection dropdown
 * @param {Array} models - List of models to display
 */
function renderModelSelect(models) {
  const container = document.getElementById("model-selection-container");
  if (!container) return;

  // Clear loading state
  container.innerHTML = `
    <strong>AI Model:</strong>
    <select id="modelSelect" onchange="window.handleModelChange(this.value)">
      <option value="">Default (Gemini 3 Flash)</option>
    </select>
  `;

  const select = document.getElementById("modelSelect");

  // Filter and sort models
  // Prefer stable models over experimental/preview
  const sortedModels = models.sort((a, b) => {
    const aName = a.displayName || a.name;
    const bName = b.displayName || b.name;
    return aName.localeCompare(bName);
  });

  sortedModels.forEach((model) => {
    // Extract model ID from name (models/gemini-1.5-flash -> gemini-1.5-flash)
    const modelId = model.name.replace("models/", "");

    // Skip vision-only or embedding models if necessary,
    // but the server already filters for generateContent

    const option = document.createElement("option");
    option.value = modelId;
    option.textContent = model.displayName || modelId;

    // Select default if it matches
    if (modelId === "gemini-3-flash-preview") {
      option.selected = true;
      selectedModel = modelId;
    }

    select.appendChild(option);
  });

  // If we have a stored preference, try to select it
  const storedModel = localStorage.getItem("selectedModel");
  if (storedModel) {
    const option = select.querySelector(`option[value="${storedModel}"]`);
    if (option) {
      select.value = storedModel;
      selectedModel = storedModel;
    }
  }
}

/**
 * Handles model selection change
 * @param {string} modelId - The selected model ID
 */
window.handleModelChange = function (modelId) {
  selectedModel = modelId;
  localStorage.setItem("selectedModel", modelId);
  console.log(`Model changed to: ${modelId}`);
};

/**
 * Gets the currently selected model
 * @returns {string|null} The selected model ID
 */
window.getSelectedModel = function () {
  return selectedModel;
};

/**
 * Initializes the model selector
 */
async function initModelSelector() {
  const container = document.getElementById("model-selection-container");
  if (!container) return;

  container.innerHTML = "<span>Loading models...</span>";

  const models = await fetchModels();
  renderModelSelect(models);
}

// Export functions
window.initModelSelector = initModelSelector;
