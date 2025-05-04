/**
 * Socket.IO client for the desktop app
 * Handles connection to the server and event handling
 */

// Socket.IO instance
let socket = null;
let isConnected = false;

// We need to reference the global isCancelled variable
// This is defined in main.js and used across multiple files

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
          "Marked library is not loaded. Some formatting may not work correctly."
        );
        addDebugLog(
          "Marked library is not loaded. Some formatting may not work correctly.",
          "warning"
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
          "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 2px;"
        );
        console.log("Socket transport type:", socket.io.engine.transport.name);
        console.log("Socket protocol:", socket.io.engine.transport.protocol);

        // Display connection info in the UI for debugging
        const debugInfo = document.createElement("div");
        debugInfo.id = "socket-debug-info";
        debugInfo.style.cssText =
          "position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999;";
        debugInfo.innerHTML = `
            <strong>Socket.IO Debug</strong><br>
            Connected: true<br>
            Socket ID: ${socket.id}<br>
            Transport: ${socket.io.engine.transport.name}<br>
            Server URL: ${serverUrl}<br>
            <button onclick="this.parentNode.style.display='none'">Close</button>
          `;
        document.body.appendChild(debugInfo);

        isConnected = true;
        resolve(true);
      });

      socket.on("connect_error", (error) => {
        console.error(
          "%c Socket.IO CONNECTION ERROR: " + error,
          "background: #F44336; color: white; padding: 2px 6px; border-radius: 2px;"
        );
        console.error("Error details:", error);

        // Display error info in the UI
        const errorInfo = document.createElement("div");
        errorInfo.id = "socket-error-info";
        errorInfo.style.cssText =
          "position: fixed; bottom: 10px; right: 10px; background: rgba(255,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999;";
        errorInfo.innerHTML = `
            <strong>Socket.IO Error</strong><br>
            Error: ${error}<br>
            Server URL: ${serverUrl}<br>
            <button onclick="this.parentNode.style.display='none'">Close</button>
          `;
        document.body.appendChild(errorInfo);

        isConnected = false;
        reject(error);
      });

      socket.on("disconnect", (reason) => {
        console.log(
          "%c Socket.IO DISCONNECTED: " + reason,
          "background: #FF9800; color: white; padding: 2px 6px; border-radius: 2px;"
        );

        // Update connection info in the UI
        const debugInfo = document.getElementById("socket-debug-info");
        if (debugInfo) {
          debugInfo.innerHTML = `
              <strong>Socket.IO Debug</strong><br>
              Connected: false<br>
              Disconnect reason: ${reason}<br>
              Server URL: ${serverUrl}<br>
              <button onclick="this.parentNode.style.display='none'">Close</button>
            `;
        }

        isConnected = false;
      });

      // Monitor all incoming events for debugging
      socket.onAny((eventName, ...args) => {
        console.log(
          `%c Socket.IO EVENT RECEIVED: ${eventName}`,
          "background: #2196F3; color: white; padding: 2px 6px; border-radius: 2px;"
        );
        console.log("Event data:", ...args);

        // Update the debug info with the latest event
        const debugInfo = document.getElementById("socket-debug-info");
        if (debugInfo) {
          const eventData =
            JSON.stringify(args[0]).substring(0, 50) +
            (JSON.stringify(args[0]).length > 50 ? "..." : "");
          const eventLine = document.createElement("div");
          eventLine.innerHTML = `<small>${new Date().toLocaleTimeString()}: ${eventName} - ${eventData}</small>`;

          // Insert at the beginning, keep only last 5 events
          debugInfo.insertBefore(
            eventLine,
            debugInfo.querySelector("button").previousSibling
          );

          // Limit to last 5 events
          const events = debugInfo.querySelectorAll("small");
          if (events.length > 5) {
            debugInfo.removeChild(events[0]);
          }
        }
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
    if (window.isCancelled) return;

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
    document.getElementById("answer").innerHTML = "";

    // Disable buttons during processing
    document.getElementById("retryBtn").disabled = true;
    document.getElementById("geminiBtn").disabled = true;
    document.getElementById("toggleBtn").disabled = true;
    document.getElementById("cancelBtn").disabled = false;
  });

  // Transcript event
  socket.on("transcript", (data) => {
    if (window.isCancelled) return;

    console.log("Received transcript via Socket.IO:", data);
    addDebugLog(`Received transcript: ${data.transcript}`, "success");

    // Save the original question for potential Gemini processing
    if (!data.processedWithGemini) {
      window.originalQuestion = data.transcript;
      addDebugLog(`Saved original question: ${data.transcript}`);
    }

    // Use the original question if this is a Gemini processed result
    const displayQuestion =
      data.processedWithGemini && window.originalQuestion
        ? window.originalQuestion
        : data.transcript;

    // Format question for display - handle multiple questions
    let formattedQuestion = displayQuestion;
    if (displayQuestion.includes(" | ")) {
      // We have multiple questions, format them as a list
      const questions = displayQuestion.split(" | ");
      formattedQuestion = questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("<br>");
    }

    // Only update the question display if there's actual content
    if (formattedQuestion && formattedQuestion.trim()) {
      document.getElementById(
        "question"
      ).innerHTML = `<strong>Question:</strong> ${formattedQuestion}`;
    }

    // Add visual debugging information
    const debugInfo = `
      <div style="background-color: #f0f0f0; padding: 10px; margin: 10px 0; border: 1px solid #ccc; font-family: monospace; font-size: 12px;">
        <strong>Debug Info:</strong><br>
        Transcript received: ${data.transcript}<br>
        Socket.IO connected: ${socket.connected}<br>
        Current time: ${new Date().toLocaleTimeString()}<br>
      </div>
    `;

    // Prepare for answer streaming with debug info
    const answerElement = document.getElementById("answer");
    if (answerElement) {
      answerElement.innerHTML = `
        <strong>Answer:</strong>
        ${debugInfo}
        <div id="livePreview">Waiting for response...</div>
        <div id="streamingContent" class="stream-active" style="display: none;"></div>
      `;
      console.log("Prepared answer element for streaming with debug info");
    } else {
      console.error("Answer element not found");
    }

    // Reset animation state for the new answer
    if (typeof resetAnimationState === "function") {
      resetAnimationState();
      console.log("Animation state reset");
    } else {
      // Fallback if the function isn't available
      window.previousContent = "";
      window.animationInProgress = false;
      window.animationQueue = [];
      window.streamedContent = "";
      console.log("Animation state reset (fallback method)");
    }

    // Update loading message
    const loading = document.getElementById("loading");
    if (loading) {
      loading.innerHTML =
        '<div class="loader"></div><span>Generating answer...</span>';
      loading.style.display = "block";
      console.log("Updated loading message");
    } else {
      console.error("Loading element not found");
    }
  });

  // Stream chunk event
  socket.on("streamChunk", (data) => {
    if (window.isCancelled) return;

    console.log("Received streamChunk via Socket.IO:", data);
    addDebugLog(
      `Received stream chunk, length: ${
        data.chunk ? data.chunk.length : 0
      } chars`
    );

    // Check if data.chunk exists
    if (!data || !data.chunk) {
      console.error("Invalid streamChunk data received:", data);
      addDebugLog("Invalid streamChunk data received", "error");
      return;
    }

    // Add the new chunk to the total content
    window.streamedContent += data.chunk;
    console.log(
      "Updated streamedContent, length:",
      window.streamedContent.length
    );

    // Show a preview of the chunk in the debug log
    const chunkPreview =
      data.chunk.length > 30 ? data.chunk.substring(0, 30) + "..." : data.chunk;
    addDebugLog(`Chunk preview: "${chunkPreview.replace(/\n/g, "\\n")}"`);

    // Update the debug log with the total content length
    addDebugLog(`Total content length: ${window.streamedContent.length} chars`);

    // DIRECT APPROACH: Also update a live preview of the content as it comes in
    // This provides a simple, direct way to see the content without relying on the animation system
    try {
      // Format the content
      let formattedContent;
      if (typeof marked !== "undefined") {
        formattedContent = marked.parse(window.streamedContent);
        console.log("Formatted content with marked library");
      } else {
        formattedContent = window.streamedContent
          .replace(/\n\n/g, "<br><br>")
          .replace(/\n/g, "<br>");
        console.log("Formatted content with basic formatting");
      }

      // Display a preview of the content directly
      const answerElement = document.getElementById("answer");
      if (answerElement) {
        // Check if we already have a direct preview element
        let previewElement = document.getElementById("livePreview");

        if (!previewElement) {
          // Create the structure if it doesn't exist
          answerElement.innerHTML = `
            <strong>Answer:</strong>
            <div id="livePreview">${formattedContent}</div>
            <div id="streamingContent" class="stream-active" style="display: none;"></div>
          `;
          console.log("Created live preview element");
        } else {
          // Update the existing preview
          previewElement.innerHTML = formattedContent;
          console.log("Updated live preview element");
        }
      }

      // Also continue with the animation system as a backup
      if (window.animationQueue.length > 5) {
        window.animationQueue = window.animationQueue.slice(-4);
        console.log("Animation queue trimmed to prevent overflow");
      }

      window.animationQueue.push(formattedContent);

      if (!window.animationInProgress) {
        console.log("Starting animation process (backup approach)");
        if (typeof processNextAnimation === "function") {
          processNextAnimation();
        } else {
          console.warn("processNextAnimation function not available");
          // Fallback - just display the content directly
          const contentElement = document.getElementById("streamingContent");
          if (contentElement) {
            contentElement.innerHTML = formattedContent;
            contentElement.style.display = "block";
          }
        }
      }
    } catch (error) {
      console.error("Error parsing markdown:", error);
    }
  });

  // Stream end event
  socket.on("streamEnd", (data) => {
    if (window.isCancelled) {
      window.isCancelled = false;
      addDebugLog(
        "Stream end ignored because request was cancelled",
        "warning"
      );
      return;
    }

    console.log("Received streamEnd via Socket.IO:", data);
    addDebugLog("Received stream end event", "success");

    // Log the full answer length if available
    if (data && data.fullAnswer) {
      addDebugLog(
        `Full answer received, length: ${data.fullAnswer.length} chars`
      );

      // Show a preview of the answer
      const answerPreview =
        data.fullAnswer.length > 50
          ? data.fullAnswer.substring(0, 50) + "..."
          : data.fullAnswer;
      addDebugLog(`Answer preview: "${answerPreview.replace(/\n/g, "\\n")}"`);
    } else {
      addDebugLog("No fullAnswer in streamEnd data", "warning");
    }

    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
      console.log("Hidden loading indicator");
    } else {
      console.error("Loading element not found");
    }

    const status = document.getElementById("status");
    if (status) {
      status.className = "status idle";
      status.textContent = "Status: Idle";
      console.log("Updated status to idle");
    } else {
      console.error("Status element not found");
    }

    // DIRECT APPROACH: Always display the full answer directly in the answer element
    // This bypasses the animation system entirely
    console.log("Displaying answer directly in answer element");

    // Get the full answer from the data or use the accumulated streamedContent
    const fullAnswer = data.fullAnswer || window.streamedContent;
    console.log("Full answer length:", fullAnswer.length);

    // Format the answer
    let formattedAnswer;
    if (typeof marked !== "undefined") {
      formattedAnswer = marked.parse(fullAnswer);
      console.log("Formatted answer with marked library");
    } else {
      formattedAnswer = fullAnswer
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
      console.log("Formatted answer with basic formatting");
    }

    // Display the answer directly in the answer element
    const answerElement = document.getElementById("answer");
    if (answerElement) {
      // Create a simple structure with the answer
      answerElement.innerHTML = `
        <strong>Answer:</strong>
        <div id="directContent">${formattedAnswer}</div>
      `;
      console.log("Answer displayed directly in answer element");
    } else {
      console.error("Answer element not found for direct update");
    }

    // Also try the animation approach as a backup
    if (window.animationQueue.length > 0) {
      console.log("Processing final animation state (backup approach)");
      const finalContent =
        window.animationQueue[window.animationQueue.length - 1];
      window.animationQueue = [];

      const contentElement = document.getElementById("streamingContent");
      if (contentElement) {
        contentElement.innerHTML = finalContent;
        console.log("Updated streamingContent element with final content");
        contentElement.classList.remove("stream-active");
      }
    }

    document.getElementById("retryBtn").disabled = false;
    document.getElementById("geminiBtn").disabled = false;
    document.getElementById("toggleBtn").disabled = false;
    document.getElementById("cancelBtn").disabled = true;

    // Store the audio file reference if provided
    if (data.audioFile) {
      window.lastAudioFile = data.audioFile;
    }

    // Enable follow-up checkbox if we have a valid transcript
    if (data.transcript && data.transcript.trim() !== "") {
      window.hasLastQuestion = true;
      updateFollowUpCheckbox();
    }

    // Save to history
    if (data.transcript && data.fullAnswer) {
      let formattedQuestion = data.transcript;
      if (data.transcript.includes(" | ")) {
        const questions = data.transcript.split(" | ");
        formattedQuestion = questions.map((q, i) => `${i + 1}. ${q}`).join(" ");
      }

      // Check if saveToHistory function is available
      if (typeof saveToHistory === "function") {
        saveToHistory(formattedQuestion, data.fullAnswer);
      } else {
        console.warn(
          "saveToHistory function not available - history not saved"
        );
        // Fallback - save to localStorage directly if needed
        try {
          const historyKey =
            "ai_assistant_history_" + new Date().toISOString().split("T")[0];
          let todayHistory = [];
          const existingData = localStorage.getItem(historyKey);
          if (existingData) {
            todayHistory = JSON.parse(existingData);
          }

          const newEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            question: formattedQuestion,
            answer: data.fullAnswer,
          };

          todayHistory.push(newEntry);
          localStorage.setItem(historyKey, JSON.stringify(todayHistory));
          console.log("Saved history entry using fallback method");
        } catch (error) {
          console.error("Failed to save history using fallback method:", error);
        }
      }
    }

    // Reset animation state
    if (typeof resetAnimationState === "function") {
      resetAnimationState();
    } else {
      // Fallback if the function isn't available
      window.previousContent = "";
      window.animationInProgress = false;
      window.animationQueue = [];
      window.streamedContent = "";
    }
  });

  // Error event
  socket.on("error", (errorMessage) => {
    if (window.isCancelled) {
      window.isCancelled = false;
      return;
    }

    console.error("Received error via Socket.IO:", errorMessage);

    document.getElementById("loading").style.display = "none";
    const status = document.getElementById("status");
    status.className = "status idle";
    status.textContent = "Status: Idle";

    document.getElementById(
      "answer"
    ).innerHTML = `<strong style="color: red;">Error:</strong> ${errorMessage}`;
    document.getElementById("retryBtn").disabled = false;
    document.getElementById("geminiBtn").disabled = false;
    document.getElementById("toggleBtn").disabled = false;
    document.getElementById("cancelBtn").disabled = true;

    updateFollowUpCheckbox();
  });

  // Stream error event
  socket.on("streamError", (data) => {
    if (window.isCancelled) {
      window.isCancelled = false;
      return;
    }

    console.error("Received streamError via Socket.IO:", data);

    document.getElementById("loading").style.display = "none";
    const status = document.getElementById("status");
    status.className = "status idle";
    status.textContent = "Status: Idle";

    document.getElementById(
      "answer"
    ).innerHTML = `<strong style="color: red;">Streaming Error:</strong> ${
      data.error || "Unknown error"
    }`;
    document.getElementById("retryBtn").disabled = false;
    document.getElementById("geminiBtn").disabled = false;
    document.getElementById("toggleBtn").disabled = false;
    document.getElementById("cancelBtn").disabled = true;

    updateFollowUpCheckbox();
  });
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
      `Updated follow-up checkbox: disabled=${followUpCheckbox.disabled}, checked=${followUpCheckbox.checked}, hasLastQuestion=${window.hasLastQuestion}`
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
        "Socket.IO client library not loaded. Please refresh the page and try again."
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

        // Update the debug info
        const debugInfo = document.getElementById("socket-debug-info");
        if (debugInfo) {
          debugInfo.innerHTML = `
          <strong>Socket.IO Debug</strong><br>
          Connected: true<br>
          Socket ID: ${socket.id}<br>
          Transport: ${socket.io.engine.transport.name}<br>
          Server URL: ${url}<br>
          <button onclick="this.parentNode.style.display='none'">Close</button>
        `;
        } else {
          // Create a new debug info element
          const newDebugInfo = document.createElement("div");
          newDebugInfo.id = "socket-debug-info";
          newDebugInfo.style.cssText =
            "position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; z-index: 9999;";
          newDebugInfo.innerHTML = `
          <strong>Socket.IO Debug</strong><br>
          Connected: true<br>
          Socket ID: ${socket.id}<br>
          Transport: ${socket.io.engine.transport.name}<br>
          Server URL: ${url}<br>
          <button onclick="this.parentNode.style.display='none'">Close</button>
        `;
          document.body.appendChild(newDebugInfo);
        }

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
      true
    );
  }, 5000);

  // Listen for the response
  socket.once("testConnectionResponse", (data) => {
    clearTimeout(timeoutId);
    console.log("Received test response:", data);
    displayDirectResponse(
      `Socket.IO test successful! Server responded: ${JSON.stringify(data)}`,
      false
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

  const answerElement = document.getElementById("answer");
  if (!answerElement) {
    console.error("Answer element not found for direct response");
    return;
  }

  // Format the content
  let formattedContent;
  try {
    if (typeof marked !== "undefined" && !isError) {
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
