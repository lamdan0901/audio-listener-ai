// Global variables for Socket.IO
var globalSocket = null;
var isGlobalSocketConnected = false;

// Function to connect to Socket.IO server
function connectGlobalSocket(url) {
  try {
    // Create a new Socket.IO connection
    globalSocket = io(url, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true,
    });

    // Set up event handlers
    globalSocket.on("connect", function () {
      isGlobalSocketConnected = true;

      // Update status
      var statusElement = document.getElementById("global-socket-status");
      if (statusElement) {
        statusElement.textContent = "Connected";
        statusElement.style.backgroundColor = "#4CAF50";
      }
    });

    globalSocket.on("connect_error", function (error) {
      isGlobalSocketConnected = false;

      // Update status
      var statusElement = document.getElementById("global-socket-status");
      if (statusElement) {
        statusElement.textContent = "Connection Error";
        statusElement.style.backgroundColor = "#F44336";
      }
    });

    globalSocket.on("disconnect", function (reason) {
      isGlobalSocketConnected = false;

      // Update status
      var statusElement = document.getElementById("global-socket-status");
      if (statusElement) {
        statusElement.textContent = "Disconnected";
        statusElement.style.backgroundColor = "#FF9800";
      }
    });

    // Set up event listeners for common events
    globalSocket.on("transcript", function (data) {
      // Display the transcript
      var questionElement = document.getElementById("question");
      if (questionElement) {
        questionElement.innerHTML =
          "<strong>Question:</strong> " + data.transcript;
      }
    });

    globalSocket.on("streamChunk", function (data) {
      // Append the chunk to the answer
      if (data && data.chunk) {
        var answerElement = document.getElementById("answer");
        if (answerElement) {
          // Create or update the answer content
          var contentElement = document.getElementById("global-answer-content");
          if (!contentElement) {
            answerElement.innerHTML =
              "<strong>Answer:</strong><div id='global-answer-content'></div>";
            contentElement = document.getElementById("global-answer-content");
          }

          if (contentElement) {
            // Append the chunk and render as markdown using our utility if available
            if (typeof window.markdownUtils !== "undefined") {
              contentElement.innerHTML += window.markdownUtils.parseMarkdown(
                data.chunk
              );
            } else {
              contentElement.innerHTML += marked.parse(data.chunk);
            }
          }
        }
      }
    });

    globalSocket.on("streamEnd", function (data) {
      // Ensure the final content is rendered as markdown
      var contentElement = document.getElementById("global-answer-content");
      if (contentElement) {
        // Use our markdown utility if available
        if (typeof window.markdownUtils !== "undefined") {
          contentElement.innerHTML = window.markdownUtils.parseMarkdown(
            contentElement.innerHTML
          );
        } else {
          contentElement.innerHTML = marked.parse(contentElement.innerHTML);
        }
      }

      // Update status to Idle
      var statusElement = document.getElementById("status");
      if (statusElement) {
        statusElement.textContent = "Status: Idle";
        statusElement.className = "status idle";
      }
      var loadingElement = document.getElementById("loading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }

      // Reset button states
      var toggleBtn = document.getElementById("toggleBtn");
      var retryBtn = document.getElementById("retryBtn");
      var geminiBtn = document.getElementById("geminiBtn");
      var cancelBtn = document.getElementById("cancelBtn");

      if (toggleBtn) {
        toggleBtn.disabled = false;
        toggleBtn.textContent = "Start Listening";
      }
      if (retryBtn) retryBtn.disabled = false;
      if (geminiBtn) retryBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = true;

      // Update recording state
      window.isRecording = false;

      // Update follow-up checkbox state
      if (typeof window.updateFollowUpCheckbox === "function") {
        window.updateFollowUpCheckbox();
      }
    });

    // Add listener for transcription response
    globalSocket.on("transcriptionResponse", function (data) {
      // Display the transcript
      var questionElement = document.getElementById("question");
      if (questionElement && data.transcript) {
        questionElement.innerHTML =
          "<strong>Question:</strong> " + data.transcript;
      }
    });

    // Add listener for error response
    globalSocket.on("transcriptionError", function (data) {
      // Handle error, maybe update status or display an error message
    });

    return true;
  } catch (error) {
    console.error("Error creating global Socket.IO connection:", error);
    return false;
  }
}

// Automatically connect after a short delay
setTimeout(function () {
  if (typeof io !== "undefined") {
    console.log("Socket.IO is available globally, attempting connection...");
    connectGlobalSocket("http://localhost:3033");
  } else {
    console.error("Socket.IO is not available globally");
    alert(
      "Socket.IO is not available globally. The application may not function correctly."
    );
  }
}, 2000);
