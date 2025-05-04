// Audio recording and processing functions
let currentAbortController = null; // Controller for cancelling fetch requests

/**
 * Toggles the recording state on/off and updates the UI accordingly.
 * Starts or stops audio recording, sends appropriate requests to the server,
 * and manages UI elements based on the current recording state.
 */
async function toggleRecording() {
  const btn = document.getElementById("toggleBtn");
  const status = document.getElementById("status");
  const loading = document.getElementById("loading");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  // grab the selected language each time
  const lang = document.querySelector('input[name="language"]:checked').value;
  // get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // get the custom context if provided
  const customContext =
    document.getElementById("customContextInput").value || "";
  // get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Check the actual recording state from the audio recorder
  const actuallyRecording = window.audioRecorder.isRecording();

  // Use the actual recording state to determine what to do
  if (!actuallyRecording) {
    // START RECORDING
    // Reset UI elements when starting a new recording
    document.getElementById("question").innerHTML = "";
    document.getElementById("answer").innerHTML = "";
    retryBtn.disabled = true;
    geminiBtn.disabled = true;
    cancelBtn.disabled = false;

    // Disable the follow-up checkbox during recording
    if (followUpCheckbox) {
      followUpCheckbox.disabled = true;
    }

    // Reset loading message to default
    loading.innerHTML =
      '<div class="loader"></div><span>Processing your question...</span>';
    loading.style.display = "none";

    // Clear audio files in the audio folder on the server
    try {
      const apiUrl = window.electronAPI.getApiBaseUrl();
      fetch(`${apiUrl}/api/v1/recording/clear-audio-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Error clearing audio files:", err));
      console.log("Sent request to clear audio files");
    } catch (error) {
      console.error("Failed to send clear audio files request:", error);
      // Continue with recording even if clearing files fails
    }

    // Start recording using the audio-recorder.js
    const recordingStarted = await window.audioRecorder.startRecording();

    if (!recordingStarted) {
      console.error("Failed to start recording");
      // Show error and revert UI
      handleStreamError("Failed to access microphone");
      window.isRecording = false; // Make sure recording state is correct
      btn.disabled = false; // Ensure button is enabled
      return;
    }

    btn.textContent = "Stop Listening";
    status.className = "status recording";
    status.textContent = "Status: Recording...";
    loading.style.display = "none";

    window.isRecording = true;

    // Update global button states
    if (typeof window.updateGlobalRecordingButtons === "function") {
      window.updateGlobalRecordingButtons();
    }
  } else {
    // STOP RECORDING - First update the state to prevent multiple clicks
    window.isRecording = false;
    btn.textContent = "Start Listening";

    // Update global button states
    if (typeof window.updateGlobalRecordingButtons === "function") {
      window.updateGlobalRecordingButtons();
    }

    // Reset loading message before showing it
    loading.innerHTML =
      '<div class="loader"></div><span>Processing your question...</span>';
    loading.style.display = "block";

    status.className = "status processing";
    status.textContent = "Status: Processing...";

    try {
      // Stop recording and get the audio blob
      const audioBlob = await window.audioRecorder.stopRecording();

      if (!audioBlob) {
        throw new Error("No audio data captured");
      }

      console.log(
        `Audio recording stopped. Blob size: ${audioBlob.size} bytes`
      );

      // Save the audio blob for retry and Gemini processing
      window.lastRecordedAudioBlob = audioBlob;

      // Create FormData to send the audio file to the backend
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      // Add other parameters
      formData.append("language", lang);
      formData.append("questionContext", questionContext);
      formData.append("customContext", customContext);
      formData.append("isFollowUp", isFollowUp);

      const apiUrl = window.electronAPI.getApiBaseUrl(); // Get API URL from preload

      // Create an AbortController for this request
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;

      // Send the audio file to the backend for processing
      const response = await fetch(`${apiUrl}/api/v1/recording/upload`, {
        method: "POST",
        body: formData,
        signal: signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Process the stream
      await processStream(response.body.getReader());
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Fetch aborted (stop recording)");
        // UI reset is handled by cancelRequest calling handleStreamEnd/Error indirectly
      } else {
        console.error("Error processing recording:", error);
        handleStreamError(error.message); // Use a common error handler
      }
      currentAbortController = null; // Clear controller on error/abort

      // Make sure the button is enabled and in the correct state
      btn.disabled = false;
    }

    // UI updates moved to stream handlers (processing starts immediately)
    handleStreamStart(); // Indicate processing has begun
  }
}

// --- Helper functions to handle stream processing and UI updates ---

/**
 * Processes the ReadableStream from the fetch response.
 * Reads chunks, decodes them, and calls UI update functions.
 * @param {ReadableStreamDefaultReader} reader - The stream reader.
 */
async function processStream(reader) {
  const decoder = new TextDecoder();
  let fullAnswer = ""; // Accumulate the full answer for history

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream finished.");
        handleStreamEnd(fullAnswer); // Pass the complete answer
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log("Received chunk:", chunk); // Log raw chunk

      // Attempt to parse the chunk as JSON (assuming server sends JSON objects per chunk)
      // Adjust parsing based on actual server stream format (e.g., Server-Sent Events)
      try {
        // Handle potential multiple JSON objects in a single chunk
        chunk
          .trim()
          .split("\n")
          .forEach((line) => {
            if (line.trim()) {
              const data = JSON.parse(line);
              console.log("Parsed data:", data); // Log parsed data
              if (data.type === "transcript") {
                handleTranscript(data.payload);
              } else if (data.type === "chunk") {
                fullAnswer += data.payload; // Accumulate answer
                handleStreamChunk(data.payload);
              } else if (data.type === "error") {
                handleStreamError(data.payload);
              } else if (data.type === "audioFile") {
                // Handle audio file info if sent
                window.lastAudioFile = data.payload;
              }
            }
          });
      } catch (e) {
        console.error("Error parsing stream chunk:", e, "Chunk:", chunk);
        // If parsing fails, maybe treat it as a raw text chunk? Depends on API design.
        // For now, we'll log the error and potentially call handleStreamChunk with raw text
        // handleStreamChunk(chunk); // Example: treat as raw text if JSON fails
      }
    }
  } catch (error) {
    console.error("Error reading stream:", error);
    handleStreamError(error.message);
  } finally {
    reader.releaseLock();
  }
}

/** Handles the start of the streaming process (UI updates) */
function handleStreamStart() {
  if (window.isCancelled) return;
  const loading = document.getElementById("loading");
  loading.innerHTML = '<div class="loader"></div><span>Processing...</span>'; // Generic processing message
  loading.style.display = "block";
  const status = document.getElementById("status");
  status.className = "status recording"; // Use 'recording' style for processing
  status.textContent = "Status: Processing...";
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML =
    '<strong>Answer:</strong> <div id="streamingContent" class="stream-active"></div>';
  document.getElementById("retryBtn").disabled = true;
  document.getElementById("geminiBtn").disabled = true;
  document.getElementById("toggleBtn").disabled = true; // Disable toggle button during processing
  document.getElementById("cancelBtn").disabled = false; // Enable cancellation during processing
  resetAnimationState(); // Reset animation for the new answer
}

// handleTranscript function is defined later in the file

// handleStreamChunk function is defined later in the file

/** Handles the end of the streaming process (UI updates) */
function handleStreamEnd(fullAnswer) {
  // Reset UI state
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Hide loading indicator
  const loading = document.getElementById("loading");
  loading.style.display = "none";

  // Reset buttons
  const toggleBtn = document.getElementById("toggleBtn");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (toggleBtn) {
    toggleBtn.textContent = "Start Listening";
    toggleBtn.disabled = false;
  }
  if (retryBtn) retryBtn.disabled = false;
  if (geminiBtn) geminiBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = true;

  // Reset recording state
  window.isRecording = false;

  // Update follow-up checkbox state
  updateFollowUpCheckbox();

  // Update global button states
  if (typeof window.updateGlobalRecordingButtons === "function") {
    window.updateGlobalRecordingButtons();
  }

  // Final animation update
  if (window.animationQueue && window.animationQueue.length > 0) {
    const finalContent =
      window.animationQueue[window.animationQueue.length - 1];
    window.animationQueue = [];
    const contentElement = document.getElementById("streamingContent");
    if (contentElement) {
      contentElement.innerHTML = finalContent;
      // Clean up animation elements
      contentElement
        .querySelectorAll(".new-content")
        .forEach((el) => el.classList.remove("new-content"));
      contentElement
        .querySelectorAll(".typing-cursor")
        .forEach((cursor) => cursor.remove());
      contentElement.classList.remove("stream-active");
    }
  } else {
    // Ensure content is displayed even if queue was empty
    const contentElement = document.getElementById("streamingContent");
    if (contentElement) {
      if (typeof window.markdownUtils !== "undefined") {
        contentElement.innerHTML = window.streamedContent
          ? window.markdownUtils.parseMarkdown(window.streamedContent)
          : "";
      } else {
        contentElement.innerHTML = window.streamedContent
          ? marked.parse(window.streamedContent)
          : "";
      }
      contentElement.classList.remove("stream-active");
    }
  }

  const displayQuestion = window.originalQuestion || "";
  if (displayQuestion.trim() !== "") {
    window.hasLastQuestion = true;
    updateFollowUpCheckbox(); // Update checkbox state
  }

  // Save to history
  if (displayQuestion && fullAnswer) {
    let formattedQuestion = displayQuestion;
    if (displayQuestion.includes(" | ")) {
      const questions = displayQuestion.split(" | ");
      formattedQuestion = questions.map((q, i) => `${i + 1}. ${q}`).join(" ");
    }
    saveToHistory(formattedQuestion, fullAnswer);
  }

  // Reset states
  resetAnimationState();
}

/** Handles errors during streaming (UI updates) */
function handleStreamError(errorMessage) {
  console.error("Stream error:", errorMessage);

  // Reset UI state
  const status = document.getElementById("status");
  status.className = "status error";
  status.textContent = "Status: Error - " + errorMessage;

  // Hide loading indicator
  const loading = document.getElementById("loading");
  loading.style.display = "none";

  // Reset buttons
  const toggleBtn = document.getElementById("toggleBtn");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (toggleBtn) {
    toggleBtn.textContent = "Start Listening";
    toggleBtn.disabled = false;
  }
  if (retryBtn) retryBtn.disabled = false;
  if (geminiBtn) geminiBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = true;

  // Reset recording state
  window.isRecording = false;

  // Update follow-up checkbox state
  updateFollowUpCheckbox();

  // Update global button states
  if (typeof window.updateGlobalRecordingButtons === "function") {
    window.updateGlobalRecordingButtons();
  }

  document.getElementById(
    "answer"
  ).innerHTML = `<strong style="color: red;">Error:</strong> ${errorMessage}`;
}

// --- End Helper Functions ---

/**
 * Tests the response display functionality with a mock response.
 * This function bypasses the audio recording and server communication,
 * directly displaying a test response in the UI.
 */
function testResponseDisplay() {
  console.log("Testing response display functionality");

  // Create a mock transcript
  const mockTranscript = "How to fetch data with react hooks";

  // Create a mock response
  const mockResponse = `
# Fetching Data with React Hooks

React Hooks provide a clean and efficient way to fetch data in functional components. Here's how to use them:

## Using useState and useEffect

The most common pattern combines useState to store the data and useEffect to fetch it:

\`\`\`jsx
import React, { useState, useEffect } from 'react';

function DataFetchingComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://api.example.com/data');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this effect runs once on mount

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Render your data here */}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
\`\`\`

## Creating a Custom Hook

For reusability, you can create a custom hook:

\`\`\`jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const result = await response.json();

        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { data, loading, error };
}
\`\`\`

Then use it in your components:

\`\`\`jsx
function UserProfile({ userId }) {
  const { data, loading, error } = useFetch(\`https://api.example.com/users/\${userId}\`);

  // Rest of component...
}
\`\`\`

## Using SWR or React Query

For more advanced data fetching, consider libraries like SWR or React Query which handle caching, revalidation, and other complex scenarios.
`;

  // Display the mock transcript
  const questionElement = document.getElementById("question");
  if (questionElement) {
    questionElement.innerHTML = `<strong>Question:</strong> ${mockTranscript}`;
  }

  // Use our direct response display function to show the mock response
  window.socketClient.displayDirectResponse(mockResponse);

  // Update UI state
  const status = document.getElementById("status");
  if (status) {
    status.className = "status idle";
    status.textContent = "Status: Idle (Test Mode)";
  }

  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "none";
  }

  // Enable buttons
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;
  document.getElementById("toggleBtn").disabled = false;
  document.getElementById("cancelBtn").disabled = true;

  console.log("Test response displayed successfully");
}

/**
 * Retries transcription of the last recorded audio file with potentially different settings.
 * Resets UI, disables relevant buttons, and sends a retry request to the server.
 * This is useful when the initial transcription was incorrect or incomplete.
 */
// --- Helper functions to handle stream processing and UI updates ---

/**
 * Processes the ReadableStream from the fetch response.
 * Reads chunks, decodes them, and calls UI update functions.
 * Assumes the server sends newline-separated JSON objects.
 * @param {ReadableStreamDefaultReader} reader - The stream reader.
 */
async function processStream(reader) {
  const decoder = new TextDecoder();
  let fullAnswer = ""; // Accumulate the full answer for history
  let buffer = ""; // Buffer for incomplete JSON lines

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream finished.");
        // Process any remaining buffer content
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer.trim());
            fullAnswer = processStreamData(data, fullAnswer); // Process the final piece
          } catch (e) {
            console.error(
              "Error parsing final buffer content:",
              e,
              "Buffer:",
              buffer
            );
            handleStreamError("Error processing final data from server.");
          }
        }
        handleStreamEnd(fullAnswer); // Pass the complete answer
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      // console.log("Received chunk, buffer:", buffer); // Verbose logging

      // Process complete lines (JSON objects separated by newline)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1); // Keep the rest in buffer

        if (line) {
          try {
            const data = JSON.parse(line);
            // console.log("Parsed data:", data); // Verbose logging
            // Update fullAnswer within the helper
            fullAnswer = processStreamData(data, fullAnswer);
          } catch (e) {
            console.error("Error parsing stream line:", e, "Line:", line);
            // Decide how to handle malformed lines - skip or error out?
            // For now, log and continue, maybe signal an error if too many occur.
          }
        }
      }
    }
  } catch (error) {
    console.error("Error reading stream:", error);
    handleStreamError(error.message);
  } finally {
    reader.releaseLock();
    // Don't clear controller here, wait for fetch promise to resolve/reject
  }
}

/**
 * Processes a single parsed data object from the stream.
 * @param {object} data - The parsed JSON object from the stream.
 * @param {string} currentFullAnswer - The currently accumulated full answer.
 * @returns {string} The updated full answer.
 */
function processStreamData(data, currentFullAnswer) {
  let updatedFullAnswer = currentFullAnswer;
  if (data.type === "transcript") {
    handleTranscript(data.payload);
  } else if (data.type === "chunk") {
    updatedFullAnswer += data.payload; // Accumulate answer
    handleStreamChunk(data.payload);
  } else if (data.type === "error") {
    handleStreamError(data.payload);
  } else if (data.type === "audioFile") {
    // Handle audio file info if sent
    window.lastAudioFile = data.payload;
  } else if (data.type === "geminiProcessed") {
    // Example: Flag from server
    document.getElementById("geminiBtn").disabled = true;
  }
  return updatedFullAnswer;
}

// handleStreamStart function is defined earlier in the file

/** Handles receiving the transcript (UI update) */
function handleTranscript(transcriptData) {
  if (window.isCancelled) return;
  // Ensure transcriptData and transcript property exist
  const transcript =
    transcriptData && transcriptData.transcript
      ? transcriptData.transcript
      : "";
  window.originalQuestion = transcript; // Save original question

  // If transcript is empty, we'll still show a message to the user
  if (!transcript.trim()) {
    console.log("Empty transcript received");
    // Make sure the toggle button is re-enabled
    document.getElementById("toggleBtn").disabled = false;
  }

  const displayQuestion = transcript; // Use transcript directly
  let formattedQuestion = displayQuestion;
  if (displayQuestion.includes(" | ")) {
    const questions = displayQuestion.split(" | ");
    formattedQuestion = questions.map((q, i) => `${i + 1}. ${q}`).join("<br>");
  }

  // Only update the question display if there's actual content
  if (formattedQuestion.trim()) {
    document.getElementById(
      "question"
    ).innerHTML = `<strong>Question:</strong> ${formattedQuestion}`;
  }

  // Prepare for answer streaming
  document.getElementById("answer").innerHTML =
    '<strong>Answer:</strong> <div id="streamingContent" class="stream-active"></div>';
  window.streamedContent = ""; // Reset streamed content for animation
  window.previousContent = "";
  window.animationQueue = [];
  window.animationInProgress = false;

  // Update loading message
  const loading = document.getElementById("loading");
  loading.innerHTML =
    '<div class="loader"></div><span>Generating answer...</span>';
}

/** Handles receiving a chunk of the answer stream (UI update) */
function handleStreamChunk(chunk) {
  if (window.isCancelled) return;

  // Check if this is an empty response or error message
  if (
    chunk.includes("Sorry, I didn't catch that") ||
    chunk.includes("Please try again")
  ) {
    console.log("Empty response or error message detected");
    // Make sure the toggle button is re-enabled
    document.getElementById("toggleBtn").disabled = false;

    // Update the status to indicate the issue
    const status = document.getElementById("status");
    if (status) {
      status.className = "status idle";
      status.textContent = "Status: No speech detected";
    }
  }

  // Initialize streamedContent if it doesn't exist
  if (!window.streamedContent) {
    window.streamedContent = "";
  }

  window.streamedContent += chunk;

  // Format the content using our markdown utility if available
  let formattedContent;
  if (typeof window.markdownUtils !== "undefined") {
    formattedContent = window.markdownUtils.parseMarkdown(
      window.streamedContent
    );
  } else {
    formattedContent = marked.parse(window.streamedContent);
  }

  // Initialize animationQueue if it doesn't exist
  if (!window.animationQueue) {
    window.animationQueue = [];
  }

  if (window.animationQueue.length > 5) {
    // Throttle updates
    window.animationQueue = window.animationQueue.slice(-4);
  }

  window.animationQueue.push(formattedContent);

  if (typeof window.animationInProgress === "undefined") {
    window.animationInProgress = false;
  }

  if (!window.animationInProgress) {
    processNextAnimation();
  }
}

// handleStreamEnd function is defined earlier in the file

// handleStreamError function is defined earlier in the file

// --- End Helper Functions ---
async function retryTranscription() {
  // Reset UI for new processing
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Check if we have a blob to retry with
  if (!window.lastRecordedAudioBlob) {
    alert("No audio data available for retry.");
    return;
  }

  // grab the selected language
  const lang = document.querySelector('input[name="language"]:checked').value;
  // get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // get the custom context if provided
  const customContext =
    document.getElementById("customContextInput").value || "";
  // get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Reset cancellation flag
  window.isCancelled = false;

  const loading = document.getElementById("loading");
  loading.innerHTML =
    '<div class="loader"></div><span>Retrying with different recognition...</span>';
  loading.style.display = "block";

  // Update status
  const status = document.getElementById("status");
  status.className = "status recording";
  status.textContent = "Status: Retrying transcription...";

  // Disable buttons during processing
  document.getElementById("retryBtn").disabled = true;
  document.getElementById("geminiBtn").disabled = true;
  document.getElementById("toggleBtn").disabled = true;

  // Disable follow-up checkbox during processing
  if (followUpCheckbox) {
    followUpCheckbox.disabled = true;
  }

  // Enable cancel button
  document.getElementById("cancelBtn").disabled = false;

  try {
    // Create FormData to send the audio file to the backend
    const formData = new FormData();
    formData.append("audio", window.lastRecordedAudioBlob, "recording.webm");

    // Add other parameters
    formData.append("language", lang);
    formData.append("questionContext", questionContext);
    formData.append("customContext", customContext);
    formData.append("isFollowUp", isFollowUp);
    formData.append("isRetry", "true"); // Flag this as a retry attempt

    const apiUrl = window.electronAPI.getApiBaseUrl(); // Get API URL from preload

    // Create an AbortController for this request
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Send the audio file to the backend for processing
    const response = await fetch(`${apiUrl}/api/v1/recording/upload`, {
      method: "POST",
      body: formData,
      signal: signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Process the stream
    await processStream(response.body.getReader());
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Fetch aborted (retry)");
    } else {
      console.error("Error processing retry request:", error);
      handleStreamError(error.message); // Use the common error handler
    }
    currentAbortController = null; // Clear controller
  }

  // UI updates moved to stream handlers (processing starts immediately)
  document.getElementById("loading").innerHTML =
    '<div class="loader"></div><span>Retrying recognition...</span>';
  handleStreamStart(); // Indicate processing has begun (will set loading display)

  // Note: Follow-up checkbox logic is handled within handleStreamEnd
}

/**
 * Processes the last recorded audio with Gemini AI instead of standard transcription.
 * Resets UI, captures the original question if available, and sends a request
 * to process the audio with Gemini AI for enhanced results.
 */
async function processWithGemini() {
  // Save the current question displayed in the UI if no originalQuestion is set
  if (!window.originalQuestion) {
    const questionElement = document.getElementById("question");
    if (questionElement.textContent) {
      // Extract just the question part removing the "Question:" prefix
      const questionText = questionElement.textContent
        .replace(/^Question:\s*/i, "")
        .trim();
      if (questionText) {
        window.originalQuestion = questionText;
      }
    }
  }

  // Reset UI for new processing
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Check if we have a blob to process with
  if (!window.lastRecordedAudioBlob) {
    alert("No audio data available for Gemini processing.");
    return;
  }

  // Grab the selected language
  const lang = document.querySelector('input[name="language"]:checked').value;
  // Get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // Get the custom context if provided
  const customContext =
    document.getElementById("customContextInput").value || "";
  // Get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Reset cancellation flag
  window.isCancelled = false;

  const loading = document.getElementById("loading");
  loading.innerHTML =
    '<div class="loader"></div><span>Processing with Gemini AI...</span>';
  loading.style.display = "block";

  // Update status
  const status = document.getElementById("status");
  status.className = "status recording";
  status.textContent = "Status: Processing with Gemini...";

  // Disable buttons during processing
  document.getElementById("retryBtn").disabled = true;
  document.getElementById("geminiBtn").disabled = true;
  document.getElementById("toggleBtn").disabled = true;

  // Disable follow-up checkbox during processing
  if (followUpCheckbox) {
    followUpCheckbox.disabled = true;
  }

  // Enable cancel button
  document.getElementById("cancelBtn").disabled = false;

  try {
    // Create FormData to send the audio file to the backend
    const formData = new FormData();
    formData.append("audio", window.lastRecordedAudioBlob, "recording.webm");

    // Add other parameters
    formData.append("language", lang);
    formData.append("questionContext", questionContext);
    formData.append("customContext", customContext);
    formData.append("isFollowUp", isFollowUp);
    formData.append("useGemini", "true"); // Flag to use Gemini processing

    const apiUrl = window.electronAPI.getApiBaseUrl(); // Get API URL from preload

    // Create an AbortController for this request
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Send the audio file to the backend for Gemini processing
    const response = await fetch(`${apiUrl}/api/v1/recording/gemini-upload`, {
      method: "POST",
      body: formData,
      signal: signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Process the stream
    await processStream(response.body.getReader());
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Fetch aborted (Gemini)");
    } else {
      console.error("Error processing Gemini request:", error);
      handleStreamError(error.message); // Use the common error handler
    }
    currentAbortController = null; // Clear controller
  }

  // UI updates moved to stream handlers (processing starts immediately)
  handleStreamStart(); // Indicate processing has begun (will set loading display and disable buttons)

  // Update loading text *after* handleStreamStart sets the initial state
  document.getElementById("loading").querySelector("span").textContent =
    "Processing with Gemini AI...";

  // Note: Follow-up checkbox logic is handled within handleStreamEnd
}

/**
 * Cancels the current recording or processing operation.
 * Resets UI state, sends cancel request to server, and re-enables buttons.
 * Also clears any results and resets animation state.
 */
async function cancelRequest() {
  // Set the cancelled flag - This prevents stream handlers from processing further
  window.isCancelled = true;
  console.log("Cancel request initiated.");

  // If we're recording, cancel the recording
  if (window.isRecording) {
    console.log("Cancelling active recording...");
    try {
      // Cancel the recording using the audio-recorder.js
      window.audioRecorder.cancelRecording();
    } catch (error) {
      console.error("Error cancelling recording:", error);
    }

    window.isRecording = false;
    const btn = document.getElementById("toggleBtn");
    btn.textContent = "Start Listening";

    // Update global button states
    if (typeof window.updateGlobalRecordingButtons === "function") {
      window.updateGlobalRecordingButtons();
    }
  }

  // Abort the ongoing fetch request, if any
  if (currentAbortController) {
    console.log("Aborting current fetch request...");
    currentAbortController.abort();
    currentAbortController = null; // Clear the controller
  } else {
    console.log("No active fetch request to abort.");
  }

  // Send cancel request to the server (optional, depends on backend needs)
  // Keep this if the backend needs explicit notification even if fetch is aborted client-side
  const apiUrl = window.electronAPI.getApiBaseUrl();

  // Try to use Socket.IO if connected, otherwise fall back to fetch
  if (window.socketClient && window.socketClient.isSocketConnected()) {
    console.log("Sending cancel request via Socket.IO");
    // Use our emitEvent function to send the cancel request
    window.socketClient.emitEvent("cancelRequest");
  } else {
    console.log("Sending cancel request via fetch");
    fetch(`${apiUrl}/api/v1/recording/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch((err) =>
      console.error("Error sending cancel request to server:", err)
    ); // Log error but don't block UI reset
  }

  // Reset UI state
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Hide loading indicator
  document.getElementById("loading").style.display = "none";

  // Reset buttons
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;
  document.getElementById("toggleBtn").disabled = false; // Make sure the toggle button is enabled
  document.getElementById("cancelBtn").disabled = true;

  // Clear any results that might have been displayed
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Re-enable follow-up checkbox if we have a previous question
  updateFollowUpCheckbox(); // Use the helper function

  // Reset animation state
  resetAnimationState(); // Use the helper function

  // Final update of global button states
  if (typeof window.updateGlobalRecordingButtons === "function") {
    window.updateGlobalRecordingButtons();
  }
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

// Expose functions to the global scope with proper typing
window.audioControls = {
  toggleRecording,
  retryTranscription,
  processWithGemini,
  cancelRequest,
  updateFollowUpCheckbox,
  // Add any new functions here as needed
};

// Initialize when the document is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Verify audio recorder is available
  if (!window.audioRecorder) {
    console.error(
      "Audio recorder not found - ensure audio-recorder.js is loaded first"
    );
    return;
  }

  // Do initial button state update
  if (typeof window.updateGlobalRecordingButtons === "function") {
    window.updateGlobalRecordingButtons();
  } else {
    console.warn("Global recording button updater not found");
  }
});
