// History management
const HISTORY_PREFIX = "ai_assistant_history_";
let historyVisible = false;
let selectedHistoryItemId = null;

/**
 * Generates a date-based key for today's history storage.
 * @returns {string} A key in the format "ai_assistant_history_YYYY-MM-DD"
 */
function getTodayHistoryKey() {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  return `${HISTORY_PREFIX}${dateStr}`;
}

/**
 * Saves a question and answer pair to local storage.
 * Organizes history by date and prevents duplicate entries.
 * @param {string} question - The question to save
 * @param {string} answer - The answer to save
 */
function saveToHistory(question, answer) {
  try {
    if (!question || !answer) return;

    // Clean up the question and answer
    const cleanQuestion = question.trim();
    const cleanAnswer = answer.trim();
    if (!cleanQuestion || !cleanAnswer) return;

    const historyKey = getTodayHistoryKey();
    let todayHistory = [];

    try {
      const existingData = localStorage.getItem(historyKey);
      if (existingData) {
        todayHistory = JSON.parse(existingData);
      }
    } catch (parseError) {
      console.error("Error parsing history data:", parseError);
      // If data is corrupted, start fresh
      todayHistory = [];
    }

    // Check if this exact Q&A pair already exists (to prevent duplicates)
    const exists = todayHistory.some(
      (item) => item.question === cleanQuestion && item.answer === cleanAnswer
    );

    if (exists) {
      console.log(
        "This Q&A pair already exists in history, not saving duplicate"
      );
      return;
    }

    // Add new entry with timestamp
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      question: cleanQuestion,
      answer: cleanAnswer,
    };

    todayHistory.push(newEntry);

    try {
      localStorage.setItem(historyKey, JSON.stringify(todayHistory));
      console.log(`Saved new entry to history: ${historyKey}`);
    } catch (storageError) {
      console.error("Failed to save to localStorage:", storageError);
      // Handle quota exceeded or other storage errors
      if (storageError.name === "QuotaExceededError") {
        alert(
          "Storage limit reached. Please clear some history to continue saving."
        );
      }
    }

    // If history panel is open, refresh it
    if (historyVisible) {
      loadHistoryDates();
      const dateSelect = document.getElementById("historyDateSelect");
      if (
        dateSelect &&
        (dateSelect.value === getTodayHistoryKey() || !dateSelect.value)
      ) {
        loadHistoryForDate(historyKey);
      } else {
        // If no date selector or it's not showing today's date, still refresh if visible
        loadHistoryForDate(historyKey);
      }
    }
  } catch (error) {
    console.error("Error saving to history:", error);
  }
}

/**
 * Loads all available history dates into the date selector dropdown.
 * Preserves selection if possible, otherwise defaults to today's date.
 * @returns {boolean} True if any history exists, false otherwise
 */
function loadHistoryDates() {
  const dateSelect = document.getElementById("historyDateSelect");

  // Get all keys from localStorage that match our prefix
  const historyKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(HISTORY_PREFIX)) {
      historyKeys.push(key);
    }
  }

  // Sort keys in reverse chronological order (newest first)
  historyKeys.sort().reverse();

  // If we have a date selector, populate it
  if (dateSelect) {
    const currentValue = dateSelect.value;

    // Clear previous options except the first one
    while (dateSelect.options.length > 1) {
      dateSelect.remove(1);
    }

    // Add options for each date
    historyKeys.forEach((key) => {
      const dateStr = key.replace(HISTORY_PREFIX, "");
      const option = document.createElement("option");

      // Format the date for display (YYYY-MM-DD to Month Day, Year)
      const [year, month, day] = dateStr.split("-");
      const date = new Date(year, month - 1, day);
      const formattedDate = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      option.value = key;
      option.textContent = formattedDate;
      dateSelect.appendChild(option);
    });

    // Restore selection or select today if available
    if (currentValue && historyKeys.includes(currentValue)) {
      dateSelect.value = currentValue;
    } else if (historyKeys.includes(getTodayHistoryKey())) {
      dateSelect.value = getTodayHistoryKey();
    }
  }

  return historyKeys.length > 0;
}

/**
 * Loads and displays history entries for a specific date.
 * Sorts entries from newest to oldest and creates clickable elements for each.
 * @param {string} dateKey - The localStorage key for the date to load
 */
function loadHistoryForDate(dateKey) {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";

  const history = JSON.parse(localStorage.getItem(dateKey) || "[]");

  if (history.length === 0) {
    historyList.innerHTML =
      '<div class="history-item">No entries for this date</div>';
    return;
  }

  // Sort entries from newest to oldest
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Create elements for each history item
  history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.dataset.id = entry.id;

    // Make the entire item clickable
    item.onclick = () => viewHistoryItem(entry.id, dateKey);

    // Format the timestamp
    const time = new Date(entry.timestamp).toLocaleTimeString();

    // Create a preview of the question (first 100 chars)
    const preview =
      entry.question.length > 100
        ? entry.question.substring(0, 100) + "..."
        : entry.question;

    item.innerHTML = `
      <div class="history-item-time">${time}</div>
      <div class="history-item-preview">${preview}</div>
      <div class="history-item-actions">
        <button onclick="deleteHistoryItem(${entry.id}, '${dateKey}', event)">Delete</button>
      </div>
    `;

    historyList.appendChild(item);
  });
}

/**
 * Displays the full details of a specific history item in the detail panel.
 * Highlights the selected item in the list and formats content with Markdown.
 * @param {number} id - The ID of the history item to view
 * @param {string} dateKey - The localStorage key for the date containing the item
 */
function viewHistoryItem(id, dateKey) {
  const history = JSON.parse(localStorage.getItem(dateKey) || "[]");
  const entry = history.find((item) => item.id === id);

  if (!entry) return;

  const detailPanel = document.getElementById("history-detail");
  detailPanel.style.display = "block";

  // Format the timestamp
  const timestamp = new Date(entry.timestamp).toLocaleString();

  // Parse the answer as markdown just like the regular answers
  const formattedAnswer = marked.parse(entry.answer);

  // Determine if the question should be parsed as markdown
  // Only parse if it contains markdown-like syntax to avoid unnecessary parsing
  const hasMarkdown = /[*_`#\[\]\(\)]/.test(entry.question);
  const formattedQuestion = hasMarkdown
    ? marked.parse(entry.question)
    : `<p>${entry.question}</p>`;

  detailPanel.innerHTML = `
    <div class="history-detail-timestamp">${timestamp}</div>
    <div class="history-detail-question">${formattedQuestion}</div>
    <div class="history-detail-answer">${formattedAnswer}</div>
  `;

  // Highlight the selected item
  document.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("selected");
  });

  const selectedItem = document.querySelector(`.history-item[data-id="${id}"]`);
  if (selectedItem) {
    selectedItem.classList.add("selected");
    selectedHistoryItemId = id;
  }
}

/**
 * Deletes a specific history item after confirmation.
 * Updates localStorage and refreshes the UI accordingly.
 * @param {number} id - The ID of the history item to delete
 * @param {string} dateKey - The localStorage key for the date containing the item
 * @param {Event} event - The click event, used to prevent event bubbling
 */
function deleteHistoryItem(id, dateKey, event) {
  // Prevent the click from triggering the parent element's click event
  event.stopPropagation();

  if (!confirm("Are you sure you want to delete this item?")) {
    return;
  }

  const history = JSON.parse(localStorage.getItem(dateKey) || "[]");
  const updatedHistory = history.filter((item) => item.id !== id);

  if (updatedHistory.length === 0) {
    // If no items left, remove the entire key
    localStorage.removeItem(dateKey);
    loadHistoryDates();

    // If the deleted date was selected, reset the view
    const dateSelect = document.getElementById("historyDateSelect");
    if (dateSelect && dateSelect.value) {
      loadHistoryForDate(dateSelect.value);
    } else {
      const historyList = document.getElementById("history-list");
      if (historyList) {
        historyList.innerHTML = "";
      }

      const detailPanel = document.getElementById("history-detail");
      if (detailPanel) {
        detailPanel.style.display = "none";
      }
    }
  } else {
    // Save the updated history
    localStorage.setItem(dateKey, JSON.stringify(updatedHistory));

    // Refresh the current view
    loadHistoryForDate(dateKey);

    // If the deleted item was being viewed, clear the detail panel
    if (selectedHistoryItemId === id) {
      const detailPanel = document.getElementById("history-detail");
      if (detailPanel) {
        detailPanel.style.display = "none";
      }
      selectedHistoryItemId = null;
    }
  }
}

/**
 * Clears all history data after user confirmation.
 * Removes all history-related items from localStorage and resets the UI.
 */
function clearAllHistory() {
  if (
    !confirm(
      "Are you sure you want to clear all history? This cannot be undone."
    )
  )
    return;

  // Get all history keys
  const historyKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(HISTORY_PREFIX)) {
      historyKeys.push(key);
    }
  }

  // Remove all history items
  historyKeys.forEach((key) => localStorage.removeItem(key));

  // Reset the UI
  const historyList = document.getElementById("history-list");
  if (historyList) {
    historyList.innerHTML = "";
  }

  const detailPanel = document.getElementById("history-detail");
  if (detailPanel) {
    detailPanel.style.display = "none";
  }

  const dateSelect = document.getElementById("historyDateSelect");
  if (dateSelect) {
    dateSelect.style.display = "none";
  }

  selectedHistoryItemId = null;

  // Refresh date select
  loadHistoryDates();
}

/**
 * Toggles the visibility of the history panel.
 * Loads and displays history data when the panel is shown.
 */
function toggleHistoryPanel() {
  const historyPanel = document.getElementById("history-panel");
  const dateSelect = document.getElementById("historyDateSelect");
  const toggleBtn = document.getElementById("historyToggleBtn"); // This might not exist in desktop app
  const downloadBtn = document.getElementById("downloadHistoryBtn");

  historyVisible = !historyVisible;

  if (historyVisible) {
    // Show history
    historyPanel.style.display = "block";

    // Update toggle button text if it exists
    if (toggleBtn) {
      toggleBtn.textContent = "Hide History";
    }

    // Load available dates
    const hasHistory = loadHistoryDates();
    if (hasHistory) {
      if (dateSelect) {
        dateSelect.style.display = "block";
      }
      if (downloadBtn) {
        downloadBtn.style.display = "block";
      }

      // Select today's date by default if it exists
      const todayKey = getTodayHistoryKey();

      if (dateSelect) {
        const hasToday = Array.from(dateSelect.options).some(
          (option) => option.value === todayKey
        );

        // Load the selected date or today if it exists, otherwise use first available date
        let dateKey = dateSelect.value;
        if (!dateKey || !localStorage.getItem(dateKey)) {
          if (hasToday) {
            dateKey = todayKey;
            dateSelect.value = todayKey;
          } else if (dateSelect.options.length > 1) {
            dateKey = dateSelect.options[1].value; // First non-empty option
            dateSelect.value = dateKey;
          }
        }

        if (dateKey) {
          loadHistoryForDate(dateKey);
        }
      } else {
        // If no date selector, just load today's history
        loadHistoryForDate(todayKey);
      }
    } else {
      if (dateSelect) {
        dateSelect.style.display = "none";
      }
      if (downloadBtn) {
        downloadBtn.style.display = "none";
      }
      document.getElementById("history-list").innerHTML =
        '<div class="history-item">No history available</div>';
    }
  } else {
    // Hide history
    historyPanel.style.display = "none";

    // Update toggle button text if it exists
    if (toggleBtn) {
      toggleBtn.textContent = "Show History";
    }

    if (downloadBtn) {
      downloadBtn.style.display = "none";
    }
  }
}

/**
 * Handles the change event for the history date selector.
 * Loads history for the selected date and resets the detail view.
 */
function onHistoryDateChange() {
  const dateSelect = document.getElementById("historyDateSelect");

  if (dateSelect) {
    const dateKey = dateSelect.value;

    if (dateKey) {
      loadHistoryForDate(dateKey);
    } else {
      document.getElementById("history-list").innerHTML = "";
    }
  }

  const detailPanel = document.getElementById("history-detail");
  if (detailPanel) {
    detailPanel.style.display = "none";
  }

  selectedHistoryItemId = null;
}

/**
 * Downloads the currently selected history date as a JSON file.
 * Validates that a date is selected before proceeding.
 */
function downloadCurrentHistory() {
  const dateSelect = document.getElementById("historyDateSelect");
  if (dateSelect && dateSelect.value) {
    downloadHistory(dateSelect.value);
  } else {
    alert("Please select a date first");
  }
}

/**
 * Downloads history for a specific date as a JSON file.
 * Creates and triggers a download link with formatted data.
 * @param {string} dateKey - The localStorage key for the date to download
 */
function downloadHistory(dateKey) {
  const history = JSON.parse(localStorage.getItem(dateKey) || "[]");

  if (history.length === 0) {
    alert("No history available to download");
    return;
  }

  // Format the data for download
  const dataStr = JSON.stringify(history, null, 2);
  const dataUri =
    "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

  // Create a date-formatted filename
  const dateStr = dateKey.replace(HISTORY_PREFIX, "");
  const filename = `questions-history-${dateStr}.json`;

  // Create a download link and trigger it
  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", filename);
  linkElement.style.display = "none";
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
}

/**
 * Function to load history - wrapper for toggleHistoryPanel
 * This function is called from the "Load History" button in index.html
 */
function loadHistory() {
  toggleHistoryPanel();
}

/**
 * Function to clear history - wrapper for clearAllHistory
 * This function is called from the "Clear History" button in index.html
 */
function clearHistory() {
  clearAllHistory();
}

/**
 * Closes the history detail panel
 * This function is called from the "Close Detail" button in the history detail panel
 */
function closeHistoryDetail() {
  const detailPanel = document.getElementById("history-detail");
  if (detailPanel) {
    detailPanel.style.display = "none";
  }

  // Reset the selected item highlight
  document.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("selected");
  });

  selectedHistoryItemId = null;
}

/**
 * Downloads the currently selected history date as a JSON file.
 * Validates that a date is selected before proceeding.
 */
function downloadCurrentHistory() {
  const dateSelect = document.getElementById("historyDateSelect");
  if (dateSelect && dateSelect.value) {
    downloadHistory(dateSelect.value);
  } else {
    alert("Please select a date first");
  }
}
