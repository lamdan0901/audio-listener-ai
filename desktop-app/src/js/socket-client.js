/**
 * Socket.IO client for the desktop app
 * Handles connection to the server and event handling
 */

// Socket.IO instance
let socket = null;
let isConnected = false;

// We need to reference the global isCancelled variable
// This is defined in main.js and used across multiple files

// Cache for development state
let devEnvironmentCache = null;

/**
 * Detects if the application is running in development mode
 * @returns {Promise<boolean>} - Promise resolving to true if in development mode
 */
async function isDevEnvironment() {
  // Return from cache if already determined
  if (devEnvironmentCache !== null) {
    return devEnvironmentCache;
  }

  // First, check if we're in Electron and can use the isDevelopment API
  const isElectron =
    window.navigator.userAgent.toLowerCase().indexOf("electron") > -1;

  if (isElectron && window.electronAPI && window.electronAPI.isDevelopment) {
    try {
      devEnvironmentCache = await window.electronAPI.isDevelopment();
      return devEnvironmentCache;
    } catch (error) {
      console.error("Error getting development environment status:", error);
      devEnvironmentCache = true; // Default to true on error
      return true;
    }
  }

  devEnvironmentCache = true; // Default to true for non-Electron environments
  return true;
}

/**
 * Initializes the Socket.IO connection to the server
 * @param {string} serverUrl - The URL of the Socket.IO server
 * @returns {Promise<boolean>} - Promise resolving to true if connection was successful
 */
async function initializeSocket(serverUrl) {
  return new Promise((resolve, reject) => {
    try {
      // Check if Socket.IO is available
      if (typeof io === "undefined") {
        console.error("Socket.IO client library not loaded");
        addDebugLog("Socket.IO client library not loaded", "error");
        reject(new Error("Socket.IO client library not loaded"));
        return;
      }

      console.log("Socket.IO client library is available");
      addDebugLog("Socket.IO client library is available", "success");

      // Check if marked library is available
      if (typeof marked === "undefined") {
        console.warn(
          "Marked library is not loaded. Some formatting may not work correctly.",
        );
        addDebugLog(
          "Marked library is not loaded. Some formatting may not work correctly.",
          "warning",
        );
      } else {
        console.log("Marked library is loaded");
        addDebugLog("Marked library is loaded", "success");
      }

      // Add debug info about the server URL
      console.log("Attempting to connect to Socket.IO server at:", serverUrl);
      addDebugLog(`Connecting to Socket.IO server: ${serverUrl}`);

      // Initialize streamedContent if it doesn't exist
      if (typeof window.streamedContent === "undefined") {
        window.streamedContent = "";
      }

      // Initialize animation queue if it doesn't exist
      if (typeof window.animationQueue === "undefined") {
        window.animationQueue = [];
      }

      // Initialize animation in progress flag if it doesn't exist
      if (typeof window.animationInProgress === "undefined") {
        window.animationInProgress = false;
      }

      // Create a more robust Socket.IO connection with fallback options
      socket = io(serverUrl, {
        transports: ["websocket", "polling"], // Try websocket first, fall back to polling
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });

      // Set up event handlers with enhanced debugging
      socket.on("connect", () => {
        console.log(
          "%c Socket.IO CONNECTED: " + socket.id,
          "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 2px;",
        );
        console.log("Socket transport type:", socket.io.engine.transport.name);
        console.log("Socket protocol:", socket.io.engine.transport.protocol);

        isDevEnvironment().then((isDev) => {
          if (isDev) {
            // Create the debug container
            const debugInfo = document.createElement("div");
            debugInfo.id = "socket-debug-info";
            debugInfo.style.cssText =
              "position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999; overflow: hidden; transition: all 0.3s ease;";

            // Create the debug content container (initially hidden)
            const debugContent = document.createElement("div");
            debugContent.id = "socket-debug-content";
            debugContent.style.cssText = "display: none; padding: 10px;";
            debugContent.innerHTML = `
                Connected: true<br>
                Socket ID: ${socket.id}<br>
                Transport: ${socket.io.engine.transport.name}<br>
                Server URL: ${serverUrl}<br>
            `;

            // Create the header/toggle button
            const debugHeader = document.createElement("div");
            debugHeader.style.cssText =
              "padding: 3px 6px; cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.8); font-size: 10px;";
            debugHeader.textContent = "Socket.IO Debug";
            debugHeader.onclick = function () {
              const content = document.getElementById("socket-debug-content");
              if (content) {
                if (content.style.display === "none") {
                  content.style.display = "block";
                  debugHeader.style.fontSize = "12px";
                  debugHeader.style.padding = "5px 10px";
                } else {
                  content.style.display = "none";
                  debugHeader.style.fontSize = "10px";
                  debugHeader.style.padding = "3px 6px";
                }
              }
            };

            // Create close button
            const closeButton = document.createElement("button");
            closeButton.style.cssText = "margin-top: 10px;";
            closeButton.textContent = "Close";
            closeButton.onclick = function (e) {
              e.stopPropagation(); // Prevent triggering the header click
              document.getElementById("socket-debug-info").style.display =
                "none";
            };

            // Assemble the components
            debugInfo.appendChild(debugHeader);
            debugInfo.appendChild(debugContent);
            debugContent.appendChild(closeButton);
            document.body.appendChild(debugInfo);
          }
        });

        isConnected = true;
        resolve(true);
      });

      socket.on("connect_error", (error) => {
        console.error(
          "%c Socket.IO CONNECTION ERROR: " + error,
          "background: #F44336; color: white; padding: 2px 6px; border-radius: 2px;",
        );
        console.error("Error details:", error);

        isDevEnvironment().then((isDev) => {
          if (isDev) {
            // Create the error container
            const errorInfo = document.createElement("div");
            errorInfo.id = "socket-error-info";
            errorInfo.style.cssText =
              "position: fixed; bottom: 10px; left: 10px; background: rgba(255,0,0,0.7); color: white; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999; overflow: hidden; transition: all 0.3s ease;";

            // Create the error content container (initially hidden)
            const errorContent = document.createElement("div");
            errorContent.id = "socket-error-content";
            errorContent.style.cssText = "display: none; padding: 10px;";
            errorContent.innerHTML = `
                Error: ${error}<br>
                Server URL: ${serverUrl}<br>
            `;

            // Create the header/toggle button
            const errorHeader = document.createElement("div");
            errorHeader.style.cssText =
              "padding: 3px 6px; cursor: pointer; font-weight: bold; background: rgba(255,0,0,0.8); font-size: 10px;";
            errorHeader.textContent = "Socket.IO Error";
            errorHeader.onclick = function () {
              const content = document.getElementById("socket-error-content");
              if (content) {
                if (content.style.display === "none") {
                  content.style.display = "block";
                  errorHeader.style.fontSize = "12px";
                  errorHeader.style.padding = "5px 10px";
                } else {
                  content.style.display = "none";
                  errorHeader.style.fontSize = "10px";
                  errorHeader.style.padding = "3px 6px";
                }
              }
            };

            // Create close button
            const closeButton = document.createElement("button");
            closeButton.style.cssText = "margin-top: 10px;";
            closeButton.textContent = "Close";
            closeButton.onclick = function (e) {
              e.stopPropagation(); // Prevent triggering the header click
              document.getElementById("socket-error-info").style.display =
                "none";
            };

            // Assemble the components
            errorInfo.appendChild(errorHeader);
            errorInfo.appendChild(errorContent);
            errorContent.appendChild(closeButton);
            document.body.appendChild(errorInfo);
          }
        });

        isConnected = false;
        reject(error);
      });

      socket.on("disconnect", (reason) => {
        console.log(
          "%c Socket.IO DISCONNECTED: " + reason,
          "background: #FF9800; color: white; padding: 2px 6px; border-radius: 2px;",
        );

        isDevEnvironment().then((isDev) => {
          if (isDev) {
            const debugContent = document.getElementById(
              "socket-debug-content",
            );
            if (debugContent) {
              // Update just the content part, preserving the header and toggle functionality
              debugContent.innerHTML = `
                Connected: false<br>
                Disconnect reason: ${reason}<br>
                Server URL: ${serverUrl}<br>
                <button onclick="document.getElementById('socket-debug-info').style.display='none'">Close</button>
              `;
            } else {
              // If the debug info doesn't exist yet, create it
              const debugInfo = document.createElement("div");
              debugInfo.id = "socket-debug-info";
              debugInfo.style.cssText =
                "position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999; overflow: hidden; transition: all 0.3s ease;";

              // Create the debug content container (initially hidden)
              const debugContent = document.createElement("div");
              debugContent.id = "socket-debug-content";
              debugContent.style.cssText = "display: none; padding: 10px;";
              debugContent.innerHTML = `
                  Connected: false<br>
                  Disconnect reason: ${reason}<br>
                  Server URL: ${serverUrl}<br>
              `;

              // Create the header/toggle button
              const debugHeader = document.createElement("div");
              debugHeader.style.cssText =
                "padding: 3px 6px; cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.8); font-size: 10px;";
              debugHeader.textContent = "Socket.IO Debug";
              debugHeader.onclick = function () {
                const content = document.getElementById("socket-debug-content");
                if (content) {
                  if (content.style.display === "none") {
                    content.style.display = "block";
                    debugHeader.style.fontSize = "12px";
                    debugHeader.style.padding = "5px 10px";
                  } else {
                    content.style.display = "none";
                    debugHeader.style.fontSize = "10px";
                    debugHeader.style.padding = "3px 6px";
                  }
                }
              };

              // Create close button
              const closeButton = document.createElement("button");
              closeButton.style.cssText = "margin-top: 10px;";
              closeButton.textContent = "Close";
              closeButton.onclick = function (e) {
                e.stopPropagation(); // Prevent triggering the header click
                document.getElementById("socket-debug-info").style.display =
                  "none";
              };

              // Assemble the components
              debugInfo.appendChild(debugHeader);
              debugInfo.appendChild(debugContent);
              debugContent.appendChild(closeButton);
              document.body.appendChild(debugInfo);
            }
          }
        });
      });

      // Monitor all incoming events for debugging
      socket.onAny((eventName, ...args) => {
        console.log(
          `%c Socket.IO EVENT RECEIVED: ${eventName}`,
          "background: #2196F3; color: white; padding: 2px 6px; border-radius: 2px;",
        );
        console.log("Event data:", ...args);

        isDevEnvironment().then((isDev) => {
          if (isDev) {
            const debugContent = document.getElementById(
              "socket-debug-content",
            );
            if (debugContent) {
              const eventData =
                JSON.stringify(args[0]).substring(0, 50) +
                (JSON.stringify(args[0]).length > 50 ? "..." : "");
              const eventLine = document.createElement("div");
              eventLine.innerHTML = `<small>${new Date().toLocaleTimeString()}: ${eventName} - ${eventData}</small>`;

              // Insert before the close button
              const closeButton = debugContent.querySelector("button");
              if (closeButton) {
                debugContent.insertBefore(eventLine, closeButton);
              } else {
                debugContent.appendChild(eventLine);
              }

              // Limit to last 5 events
              const events = debugContent.querySelectorAll("small");
              if (events.length > 5) {
                // Find the first event (after the static content) and remove it
                for (let i = 0; i < events.length; i++) {
                  const event = events[i];
                  if (event.textContent.includes(":")) {
                    event.parentNode.removeChild(event);
                    break;
                  }
                }
              }
            }
          }
        });
      });

      // Set up event handlers for the application
      setupSocketEventHandlers();
    } catch (error) {
      console.error("Error initializing Socket.IO:", error);
      reject(error);
    }
  });
}

/**
 * Sets up event handlers for Socket.IO events
 */
function setupSocketEventHandlers() {
  if (!socket) {
    console.error("Socket not initialized");
    return;
  }

  // Processing event
  socket.on("processing", () => {
    // A new processing operation is starting — always reset the cancelled flag
    window.isCancelled = false;

    // Reset loading message to default
    const loading = document.getElementById("loading");
    loading.innerHTML =
      '<div class="loader"></div><span>Processing your question...</span>';
    loading.style.display = "block";

    // Update status
    const status = document.getElementById("status");
    status.className = "status processing";
    status.textContent = "Status: Processing...";

    // Clear previous results
    document.getElementById("question").innerHTML = "";
    document.getElementById("answer-selected-panel").innerHTML = "";
    document.getElementById("answer-backup-panel").innerHTML = "";
    window.backupStreamedContent = "";

    // Hide dual-model tabs and reset active state
    const answerTabs = document.getElementById("answer-tabs");
    if (answerTabs) answerTabs.style.display = "none";
    const tabSel = document.getElementById("tab-selected");
    const tabDef = document.getElementById("tab-default");
    if (tabSel) tabSel.classList.add("active");
    if (tabDef) tabDef.classList.remove("active");
    const backupPanel = document.getElementById("answer-backup-panel");
    if (backupPanel) backupPanel.style.display = "none";
    const selectedPanel = document.getElementById("answer-selected-panel");
    if (selectedPanel) selectedPanel.style.display = "";

    // Disable buttons during processing
    document.getElementById("retryBtn").disabled = true;
    document.getElementById("geminiBtn").disabled = true;
    document.getElementById("toggleBtn").disabled = true;
    document.getElementById("cancelBtn").disabled = false;
  });

  // Answer received — show question, answer, set up tabs, save history
  socket.on("update", (data) => {
    if (window.isCancelled) {
      window.isCancelled = false;
      return;
    }

    console.log("Received update via Socket.IO:", data);
    addDebugLog("Received answer update", "success");

    // Save the original question for potential future use
    if (!data.processedWithGemini) {
      window.originalQuestion = data.transcript;
    }

    // Use the original question if this is a Gemini processed result
    const displayQuestion =
      data.processedWithGemini && window.originalQuestion
        ? window.originalQuestion
        : data.transcript;

    // Format question for display - handle multiple questions
    let formattedQuestion = displayQuestion;
    if (displayQuestion && displayQuestion.includes(" | ")) {
      const questions = displayQuestion.split(" | ");
      formattedQuestion = questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("<br>");
    }

    if (formattedQuestion && formattedQuestion.trim()) {
      document.getElementById("question").innerHTML =
        `<strong>Question:</strong> ${formattedQuestion}`;
    }

    // Show dual-model tabs if the server indicates a second model is running
    if (data.backupModel) {
      window.backupModelName = data.backupModel;
      const tabs = document.getElementById("answer-tabs");
      if (tabs) tabs.style.display = "flex";
      const tabSelBtn = document.getElementById("tab-selected");
      const tabDefBtn = document.getElementById("tab-default");
      const getLabel =
        window.getModelDisplayName ||
        ((id) => (id || "").split("/").pop() || id);
      const shortModel1 = getLabel(data.selectedModel) || "Model 1";
      const shortModel2 = getLabel(data.backupModel) || "Model 2";
      if (tabSelBtn) tabSelBtn.textContent = shortModel1;
      if (tabDefBtn) tabDefBtn.textContent = shortModel2;

      const backupPanelPre = document.getElementById("answer-backup-panel");
      if (backupPanelPre) {
        backupPanelPre.style.display = "none";
        backupPanelPre.innerHTML = `
          <strong>Answer (${shortModel2}):</strong>
          <div id="backupLivePreview">Waiting for response...</div>
        `;
      }
    } else {
      window.backupModelName = null;
    }

    // Hide loading and set status to idle
    const loadingElement = document.getElementById("loading");
    if (loadingElement) loadingElement.style.display = "none";

    const status = document.getElementById("status");
    if (status) {
      status.className = "status idle";
      status.textContent = "Status: Idle";
    }

    // Format and display the answer
    const answer = data.answer || "";
    let formattedAnswer;
    if (typeof window.markdownUtils !== "undefined") {
      formattedAnswer = window.markdownUtils.parseMarkdown(answer);
    } else if (typeof marked !== "undefined") {
      formattedAnswer = marked.parse(answer);
    } else {
      formattedAnswer = answer
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
    }

    const answerElement = document.getElementById("answer-selected-panel");
    if (answerElement) {
      answerElement.innerHTML = `
        <strong>Answer:</strong>
        <div id="directContent">${formattedAnswer}</div>
      `;
    }

    // Re-enable buttons
    document.getElementById("retryBtn").disabled = false;
    document.getElementById("geminiBtn").disabled = false;
    document.getElementById("toggleBtn").disabled = false;
    document.getElementById("cancelBtn").disabled = true;

    if (data.audioFile) {
      window.lastAudioFile = data.audioFile;
    }

    if (data.transcript && data.transcript.trim() !== "") {
      window.hasLastQuestion = true;
      updateFollowUpCheckbox();
    }

    // Save to history
    if (data.transcript && answer) {
      let formattedHistoryQuestion = data.transcript;
      if (data.transcript.includes(" | ")) {
        const questions = data.transcript.split(" | ");
        formattedHistoryQuestion = questions
          .map((q, i) => `${i + 1}. ${q}`)
          .join(" ");
      }
      if (typeof saveToHistory === "function") {
        saveToHistory(formattedHistoryQuestion, answer);
      }
    }

    // Reset animation state
    if (typeof resetAnimationState === "function") {
      resetAnimationState();
    } else {
      window.previousContent = "";
      window.animationInProgress = false;
      window.animationQueue = [];
      window.streamedContent = "";
    }
  });

  // Processing error event
  socket.on("processingError", (errorMessage) => {
    // Always show errors — clear the cancelled flag as a side effect
    window.isCancelled = false;

    console.error("Received error via Socket.IO:", errorMessage);

    document.getElementById("loading").style.display = "none";
    const status = document.getElementById("status");
    status.className = "status idle";
    status.textContent = "Status: Idle";

    const selPanel = document.getElementById("answer-selected-panel");
    if (selPanel) {
      selPanel.innerHTML = `<strong style="color: red;">Error:</strong> ${errorMessage}`;
    }

    document.getElementById("retryBtn").disabled = false;
    document.getElementById("geminiBtn").disabled = false;
    document.getElementById("toggleBtn").disabled = false;
    document.getElementById("cancelBtn").disabled = true;

    updateFollowUpCheckbox();
  });

  // Backup model: answer received
  socket.on("backupUpdate", (data) => {
    if (window.isCancelled) return;

    const backupPanel = document.getElementById("answer-backup-panel");
    if (!backupPanel) return;

    const fullAnswer = data.answer || "";

    let formattedBackup;
    if (typeof window.markdownUtils !== "undefined") {
      formattedBackup = window.markdownUtils.parseMarkdown(fullAnswer);
    } else if (typeof marked !== "undefined") {
      formattedBackup = marked.parse(fullAnswer);
    } else {
      formattedBackup = fullAnswer
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
    }

    const _getLabel =
      window.getModelDisplayName || ((id) => (id || "").split("/").pop() || id);
    const modelLabel = _getLabel(window.backupModelName) || "Model 2";
    backupPanel.innerHTML = `
      <strong>Answer (${modelLabel}):</strong>
      <div id="backupDirectContent">${formattedBackup}</div>
    `;
  });
}

/**
 * Switches the visible answer tab between the selected and default model results.
 * @param {"selected"|"default"} tab - Which tab to activate
 */
function switchAnswerTab(tab) {
  const selectedPanel = document.getElementById("answer-selected-panel");
  const backupPanel = document.getElementById("answer-backup-panel");
  const tabSelBtn = document.getElementById("tab-selected");
  const tabDefBtn = document.getElementById("tab-default");

  if (tab === "default") {
    if (selectedPanel) selectedPanel.style.display = "none";
    if (backupPanel) backupPanel.style.display = "";
    if (tabSelBtn) tabSelBtn.classList.remove("active");
    if (tabDefBtn) tabDefBtn.classList.add("active");
  } else {
    if (selectedPanel) selectedPanel.style.display = "";
    if (backupPanel) backupPanel.style.display = "none";
    if (tabSelBtn) tabSelBtn.classList.add("active");
    if (tabDefBtn) tabDefBtn.classList.remove("active");
  }
}

/**
 * Checks if the socket is connected
 * @returns {boolean} - True if the socket is connected
 */
function isSocketConnected() {
  return isConnected && socket && socket.connected;
}

/**
 * Updates the follow-up checkbox state based on whether there's a previous question.
 * Enables or disables the checkbox appropriately and logs debugging information.
 */
function updateFollowUpCheckbox() {
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    // Enable the checkbox if we have a previous question
    followUpCheckbox.disabled = !window.hasLastQuestion;

    // Always uncheck the checkbox after a response is given
    // This ensures it's unchecked for the next question
    followUpCheckbox.checked = false;

    // Log the state for debugging
    console.log(
      `Updated follow-up checkbox: disabled=${followUpCheckbox.disabled}, checked=${followUpCheckbox.checked}, hasLastQuestion=${window.hasLastQuestion}`,
    );
  }
}

/**
 * Adds a message to the debug log
 * @param {string} message - The message to add
 * @param {string} type - The type of message (info, error, warning)
 */
function addDebugLog(message, type = "info") {
  console.log(`Debug Log (${type}): ${message}`);

  // Get the debug log content element
  const debugLogContent = document.getElementById("debug-log-content");
  if (!debugLogContent) return;

  // Create a new log entry
  const logEntry = document.createElement("div");
  logEntry.style.borderBottom = "1px solid #ddd";
  logEntry.style.padding = "3px 0";

  // Style based on type
  let color = "black";
  switch (type) {
    case "error":
      color = "red";
      break;
    case "warning":
      color = "orange";
      break;
    case "success":
      color = "green";
      break;
    default:
      color = "black";
  }

  // Add the message with timestamp
  logEntry.innerHTML = `<span style="color: ${color}">[${new Date().toLocaleTimeString()}] ${message}</span>`;

  // Add to the log
  debugLogContent.appendChild(logEntry);

  // Scroll to bottom
  debugLogContent.scrollTop = debugLogContent.scrollHeight;
}

/**
 * Disconnects the socket
 */
function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    isConnected = false;
    console.log("Socket disconnected manually");
    addDebugLog("Socket disconnected manually", "warning");
  }
}

/**
 * Emits an event to the server
 * @param {string} eventName - The name of the event to emit
 * @param {any} data - The data to send with the event
 * @returns {boolean} - True if the event was emitted successfully
 */
function emitEvent(eventName, data = {}) {
  if (!isConnected || !socket) {
    console.error("Socket not connected, cannot emit event:", eventName);
    return false;
  }

  socket.emit(eventName, data);
  return true;
}

/**
 * Manually connects to a Socket.IO server with a specific URL
 * This is useful for testing different server URLs
 * @param {string} url - The URL to connect to
 */
function manualConnect(url) {
  console.log("Manually connecting to Socket.IO server at:", url);
  addDebugLog(`Manually connecting to: ${url}`, "info");

  // Return a promise that resolves when the connection is established
  return new Promise((resolve, reject) => {
    // Check if Socket.IO is available
    if (typeof io === "undefined") {
      const errorMsg =
        "Socket.IO client library not loaded. Cannot connect manually.";
      console.error(errorMsg);
      addDebugLog(errorMsg, "error");

      // Show an error message to the user
      alert(
        "Socket.IO client library not loaded. Please refresh the page and try again.",
      );

      // Reject the promise
      reject(new Error(errorMsg));
      return;
    }

    // If already connected, disconnect first
    if (socket) {
      socket.disconnect();
      isConnected = false;
      addDebugLog("Disconnected from previous server", "warning");
    }

    try {
      // Create a new Socket.IO connection
      socket = io(url, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });

      // Set up a timeout for the connection
      const connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          const timeoutMsg = `Connection to ${url} timed out after 10 seconds`;
          console.error(timeoutMsg);
          addDebugLog(timeoutMsg, "error");
          reject(new Error(timeoutMsg));
        }
      }, 10000);

      // Set up basic event handlers
      socket.on("connect", () => {
        console.log("Socket connected manually:", socket.id);
        addDebugLog(`Connected to ${url} with ID: ${socket.id}`, "success");
        isConnected = true;

        // Clear the connection timeout
        clearTimeout(connectionTimeout);

        // Update the socket status indicator
        const socketStatus = document.getElementById("socket-status");
        if (socketStatus) {
          socketStatus.textContent = "Connected";
          socketStatus.style.backgroundColor = "#4CAF50";
        }

        // Use isDevEnvironment in a non-async context
        isDevEnvironment().then((isDev) => {
          if (isDev) {
            const debugContent = document.getElementById(
              "socket-debug-content",
            );
            if (debugContent) {
              // Update just the content part, preserving the header and toggle functionality
              debugContent.innerHTML = `
                Connected: true<br>
                Socket ID: ${socket.id}<br>
                Transport: ${socket.io.engine.transport.name}<br>
                Server URL: ${url}<br>
                <button onclick="document.getElementById('socket-debug-info').style.display='none'">Close</button>
              `;
            } else {
              // If the debug info doesn't exist yet, create it
              const debugInfo = document.createElement("div");
              debugInfo.id = "socket-debug-info";
              debugInfo.style.cssText =
                "position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999; overflow: hidden; transition: all 0.3s ease;";

              // Create the debug content container (initially hidden)
              const debugContent = document.createElement("div");
              debugContent.id = "socket-debug-content";
              debugContent.style.cssText = "display: none; padding: 10px;";
              debugContent.innerHTML = `
                  Connected: true<br>
                  Socket ID: ${socket.id}<br>
                  Transport: ${socket.io.engine.transport.name}<br>
                  Server URL: ${url}<br>
              `;

              // Create the header/toggle button
              const debugHeader = document.createElement("div");
              debugHeader.style.cssText =
                "padding: 3px 6px; cursor: pointer; font-weight: bold; background: rgba(0,0,0,0.8); font-size: 10px;";
              debugHeader.textContent = "Socket.IO Debug";
              debugHeader.onclick = function () {
                const content = document.getElementById("socket-debug-content");
                if (content) {
                  if (content.style.display === "none") {
                    content.style.display = "block";
                    debugHeader.style.fontSize = "12px";
                    debugHeader.style.padding = "5px 10px";
                  } else {
                    content.style.display = "none";
                    debugHeader.style.fontSize = "10px";
                    debugHeader.style.padding = "3px 6px";
                  }
                }
              };

              // Create close button
              const closeButton = document.createElement("button");
              closeButton.style.cssText = "margin-top: 10px;";
              closeButton.textContent = "Close";
              closeButton.onclick = function (e) {
                e.stopPropagation(); // Prevent triggering the header click
                document.getElementById("socket-debug-info").style.display =
                  "none";
              };

              // Assemble the components
              debugInfo.appendChild(debugHeader);
              debugInfo.appendChild(debugContent);
              debugContent.appendChild(closeButton);
              document.body.appendChild(debugInfo);
            }
          }
        });

        // Set up event handlers for the application
        setupSocketEventHandlers();

        // Resolve the promise
        resolve(socket);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        addDebugLog(`Connection error: ${error}`, "error");
        isConnected = false;

        // Update the socket status indicator
        const socketStatus = document.getElementById("socket-status");
        if (socketStatus) {
          socketStatus.textContent = "Connection Error";
          socketStatus.style.backgroundColor = "#F44336";
        }

        // Reject the promise
        reject(error);
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        addDebugLog(`Disconnected: ${reason}`, "warning");
        isConnected = false;

        // Update the socket status indicator
        const socketStatus = document.getElementById("socket-status");
        if (socketStatus) {
          socketStatus.textContent = "Disconnected";
          socketStatus.style.backgroundColor = "#FF9800";
        }
      });
    } catch (error) {
      console.error("Error creating Socket.IO connection:", error);
      addDebugLog(`Error creating connection: ${error}`, "error");

      // Update the socket status indicator
      const socketStatus = document.getElementById("socket-status");
      if (socketStatus) {
        socketStatus.textContent = "Connection Error";
        socketStatus.style.backgroundColor = "#F44336";
      }

      // Reject the promise
      reject(error);
    }
  });
}

/**
 * Tests the Socket.IO connection by sending a test event to the server
 * and setting up a one-time listener for the response
 */
function testSocketConnection() {
  console.log("Testing Socket.IO connection...");

  if (!isConnected || !socket) {
    console.error("Socket not connected, cannot test");
    displayDirectResponse("Socket.IO not connected. Cannot test.", true);
    return false;
  }

  // Display a message indicating the test is in progress
  displayDirectResponse("Testing Socket.IO connection... Please wait.", false);

  // Send a test event to the server
  socket.emit("testConnection", { timestamp: Date.now() });

  // Set up a one-time listener for the response with a timeout
  const timeoutId = setTimeout(() => {
    console.error("Socket.IO test timed out after 5 seconds");
    displayDirectResponse(
      "Socket.IO test timed out after 5 seconds. No response received from server.",
      true,
    );
  }, 5000);

  // Listen for the response
  socket.once("testConnectionResponse", (data) => {
    clearTimeout(timeoutId);
    console.log("Received test response:", data);
    displayDirectResponse(
      `Socket.IO test successful! Server responded: ${JSON.stringify(data)}`,
      false,
    );
  });

  return true;
}

/**
 * Directly displays a response in the answer element
 * This is a utility function to bypass the animation system
 * @param {string} content - The content to display
 * @param {boolean} isError - Whether this is an error message
 */
function displayDirectResponse(content, isError = false) {
  console.log("Displaying direct response, isError:", isError);

  const answerElement = document.getElementById("answer-selected-panel");
  if (!answerElement) {
    console.error("Answer element not found for direct response");
    return;
  }

  // Format the content using our markdown utility
  let formattedContent;
  try {
    if (typeof window.markdownUtils !== "undefined") {
      formattedContent = window.markdownUtils.parseMarkdown(content, isError);
    } else if (typeof marked !== "undefined" && !isError) {
      formattedContent = marked.parse(content);
    } else {
      formattedContent = content
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
    }
  } catch (error) {
    console.error("Error formatting content:", error);
    formattedContent = content;
  }

  // Create a style based on whether this is an error
  const style = isError ? "color: red; font-weight: bold;" : "";

  // Display the content
  answerElement.innerHTML = `
    <strong>Answer:</strong>
    <div id="directResponse" style="${style}">${formattedContent}</div>
  `;

  console.log("Direct response displayed");
}

// Export the functions
window.socketClient = {
  initializeSocket,
  isSocketConnected,
  disconnectSocket,
  emitEvent,
  displayDirectResponse,
  testSocketConnection,
  manualConnect,
  // Expose the socket instance for direct access if needed
  getSocket: () => socket,
  // Expose the current connection status
  getConnectionStatus: () => ({
    connected: isConnected,
    socketId: socket ? socket.id : null,
    transport: socket && socket.io ? socket.io.engine.transport.name : null,
  }),
};
