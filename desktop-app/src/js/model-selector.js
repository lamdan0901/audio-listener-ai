/**
 * Model Selector Component
 * Handles fetching and selecting Gemini models
 */

let selectedModel = null;
let selectedModel2 = null;

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
 * Renders the model selection dropdowns (two parallel models)
 * @param {Array} models - List of models to display
 */
function renderModelSelect(models) {
  const container = document.getElementById("model-selection-container");
  if (!container) return;

  // Filter and sort models
  const sortedModels = [...models].sort((a, b) => {
    const aName = a.displayName || a.name;
    const bName = b.displayName || b.name;
    return aName.localeCompare(bName);
  });

  // Build option HTML once and reuse for both selects
  const defaultOption1 = `<option value="">Default (Gemini 3 Flash)</option>`;
  const defaultOption2 = `<option value="">None (single model)</option>`;
  const optionsHtml = sortedModels
    .map((model) => {
      const modelId = model.name.replace("models/", "");
      const label = model.displayName || modelId;
      return `<option value="${modelId}">${label}</option>`;
    })
    .join("");

  container.innerHTML = `
    <strong>AI Models:</strong>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px;">
      <label style="display:flex;flex-direction:column;gap:2px;font-size:12px;">
        Model 1
        <select id="modelSelect1" onchange="window.handleModelChange(this.value, 1)">
          ${defaultOption1}${optionsHtml}
        </select>
      </label>
      <label style="display:flex;flex-direction:column;gap:2px;font-size:12px;">
        Model 2
        <select id="modelSelect2" onchange="window.handleModelChange(this.value, 2)">
          ${defaultOption2}${optionsHtml}
        </select>
      </label>
    </div>
  `;

  // Restore stored preferences
  const storedModel1 = localStorage.getItem("selectedModel");
  const storedModel2 = localStorage.getItem("selectedModel2");

  const select1 = document.getElementById("modelSelect1");
  const select2 = document.getElementById("modelSelect2");

  if (storedModel1) {
    const opt = select1.querySelector(`option[value="${storedModel1}"]`);
    if (opt) {
      select1.value = storedModel1;
      selectedModel = storedModel1;
    }
  }
  if (storedModel2) {
    const opt = select2.querySelector(`option[value="${storedModel2}"]`);
    if (opt) {
      select2.value = storedModel2;
      selectedModel2 = storedModel2;
    }
  }
}

/**
 * Handles model selection change
 * @param {string} modelId - The selected model ID
 * @param {number} index - 1 for primary model, 2 for secondary model
 */
window.handleModelChange = function (modelId, index) {
  if (index === 2) {
    selectedModel2 = modelId || null;
    localStorage.setItem("selectedModel2", modelId || "");
    console.log(`Model 2 changed to: ${modelId}`);
  } else {
    selectedModel = modelId;
    localStorage.setItem("selectedModel", modelId);
    console.log(`Model 1 changed to: ${modelId}`);
  }
};

/**
 * Gets the currently selected primary model
 * @returns {string|null} The selected model ID
 */
window.getSelectedModel = function () {
  return selectedModel;
};

/**
 * Gets the currently selected secondary model
 * @returns {string|null} The selected model ID or null
 */
window.getSelectedModel2 = function () {
  return selectedModel2 || null;
};

/**
 * Returns the display name for a model ID by reading from the dropdown options.
 * Falls back to the raw ID if not found.
 * @param {string} modelId - Raw model ID (e.g. "gemini-2.5-pro-preview")
 * @returns {string} Human-readable display name
 */
window.getModelDisplayName = function (modelId) {
  if (!modelId) return "Default";
  const select = document.getElementById("modelSelect1");
  if (select) {
    const opt = select.querySelector(`option[value="${modelId}"]`);
    if (opt) return opt.textContent.trim();
  }
  return modelId;
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
