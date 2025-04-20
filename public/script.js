const socket = io();
let isRecording = false;
let lastAudioFile = null;
let isCancelled = false;
let streamedContent = ""; // Variable to accumulate streamed content
let hasLastQuestion = false; // Track if we have a previous question

// Global variables to track animation state
let previousContent = "";
let animationInProgress = false;
let animationQueue = [];

// Load saved question context on page load
document.addEventListener("DOMContentLoaded", function () {
  // Reset animation state on page load
  previousContent = "";
  animationInProgress = false;
  animationQueue = [];

  // Restore saved question context from localStorage if available
  const savedQuestionContext = localStorage.getItem("questionContext");
  if (savedQuestionContext) {
    const contextSelect = document.querySelector(
      'select[name="questionContext"]'
    );
    if (contextSelect) {
      contextSelect.value = savedQuestionContext;
    }
  }

  // Add event listener to save selection to localStorage when changed
  const contextSelect = document.querySelector(
    'select[name="questionContext"]'
  );
  if (contextSelect) {
    contextSelect.addEventListener("change", function () {
      localStorage.setItem("questionContext", this.value);
    });
  }

  // Initialize follow-up checkbox state - always disabled on page load
  // unless we already have a previous session with questions
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    // Start with the checkbox disabled
    followUpCheckbox.disabled = true;
    followUpCheckbox.checked = false;

    // Add event listener to log when checkbox is toggled
    followUpCheckbox.addEventListener("change", function () {
      console.log(`Follow-up checkbox toggled: checked=${this.checked}`);
    });

    // Check if we have a previous session with questions
    // We'll request the current status from the server
    fetch("/status")
      .then((response) => response.json())
      .then((status) => {
        console.log("Server status:", status);
        // If there's a last question, we can enable follow-up questions
        if (status.hasLastQuestion) {
          console.log(`Previous question found: ${status.lastQuestionPreview}`);
          hasLastQuestion = true;
          followUpCheckbox.disabled = false;
        } else {
          console.log("No previous questions found");
          hasLastQuestion = false;
          followUpCheckbox.disabled = true;
        }
      })
      .catch((error) => {
        console.error("Error checking session status:", error);
      });
  }
});

socket.on("processing", () => {
  if (isCancelled) return;

  // Reset loading message to default
  const loading = document.getElementById("loading");
  loading.innerHTML =
    '<div class="loader"></div><span>Processing your question...</span>';
  loading.style.display = "block";

  // Update the status to indicate processing
  const status = document.getElementById("status");
  status.className = "status recording";
  status.textContent = "Status: Processing...";

  // Clear any previous results
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Disable buttons during processing
  document.getElementById("retryBtn").disabled = true;
  document.getElementById("geminiBtn").disabled = true;

  // Enable cancel button
  document.getElementById("cancelBtn").disabled = false;
});

socket.on("update", (data) => {
  if (isCancelled) {
    isCancelled = false;
    return;
  }

  document.getElementById("loading").style.display = "none";

  // Update the main status to idle when we receive results
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Display question immediately
  document.getElementById(
    "question"
  ).innerHTML = `<strong>Question:</strong> ${data.transcript}`;

  // Set up answer container with streaming content div for animation
  document.getElementById("answer").innerHTML =
    '<strong>Answer:</strong> <div id="streamingContent"></div>';

  // Apply the animation to the answer using marked formatting
  const formattedContent = marked.parse(data.answer);

  // Reset animation state
  previousContent = "";
  streamedContent = data.answer;
  animationQueue = [formattedContent];
  animationInProgress = false;

  // Start the animation process
  processNextAnimation();

  // Enable retry and Gemini buttons when we have a result
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;

  // Disable cancel button when processing is complete
  document.getElementById("cancelBtn").disabled = true;

  // If this was processed with Gemini already, disable the Gemini button
  if (data.processedWithGemini) {
    document.getElementById("geminiBtn").disabled = true;
  }

  // Store the audio file reference if provided
  if (data.audioFile) {
    lastAudioFile = data.audioFile;
  }

  // Enable follow-up checkbox if we have a valid transcript
  if (data.transcript && data.transcript.trim() !== "") {
    hasLastQuestion = true;
    updateFollowUpCheckbox(data.isFollowUp);
  }
});

socket.on("error", (message) => {
  if (isCancelled) {
    isCancelled = false;
    return;
  }

  document.getElementById("loading").style.display = "none";
  console.error("Processing error:", message);

  // Update the main status to error
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Enable retry and Gemini buttons on error as well
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;

  // Disable cancel button on error
  document.getElementById("cancelBtn").disabled = true;
});

function toggleRecording() {
  const btn = document.getElementById("toggleBtn");
  const status = document.getElementById("status");
  const loading = document.getElementById("loading");
  const retryBtn = document.getElementById("retryBtn");
  const geminiBtn = document.getElementById("geminiBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  // grab the selected language each time
  const lang = document.querySelector('input[name="language"]:checked').value;
  // get the selected speech speed
  const speechSpeed =
    document.querySelector('select[name="speechSpeed"]').value || "normal";
  // get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  if (!isRecording) {
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

    fetch("/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        speechSpeed: speechSpeed,
        questionContext: questionContext,
        duration: 90, // Increase default recording duration to 90 seconds for multiple questions
      }),
    });
    btn.textContent = "Stop Listening";
    status.className = "status recording";
    status.textContent = "Status: Recording...";
    loading.style.display = "none";
  } else {
    // Reset loading message before showing it
    loading.innerHTML =
      '<div class="loader"></div><span>Processing your question...</span>';

    fetch("/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: lang,
        speechSpeed: speechSpeed,
        questionContext: questionContext,
        isFollowUp: isFollowUp,
      }),
    });
    btn.textContent = "Start Listening";
    status.className = "status idle";
    status.textContent = "Status: Idle";
    loading.style.display = "block";
  }

  isRecording = !isRecording;
}

function retryTranscription() {
  // Reset UI for new processing
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Check if we have a file to retry with
  if (!lastAudioFile) {
    alert("No audio file available for retry.");
    return;
  }

  // grab the selected language
  const lang = document.querySelector('input[name="language"]:checked').value;
  // get the selected speech speed
  const speechSpeed =
    document.querySelector('select[name="speechSpeed"]').value || "normal";
  // get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Reset cancellation flag
  isCancelled = false;

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

  // Send the retry request with the audio file path
  fetch("/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioFile: lastAudioFile,
      language: lang,
      speechSpeed: speechSpeed,
      questionContext: questionContext,
      isFollowUp: isFollowUp,
    }),
  })
    .then((response) => {
      // Re-enable the recording button once the request is sent
      document.getElementById("toggleBtn").disabled = false;
    })
    .catch((error) => {
      console.error("Error sending retry request:", error);
      document.getElementById("loading").style.display = "none";
      document.getElementById("toggleBtn").disabled = false;
      document.getElementById("retryBtn").disabled = false;
      document.getElementById("geminiBtn").disabled = false;
      document.getElementById("cancelBtn").disabled = true;

      // Re-enable follow-up checkbox if there was an error
      if (followUpCheckbox && hasLastQuestion) {
        followUpCheckbox.disabled = false;
      }

      alert("Failed to send retry request: " + error.message);
    });

  // If this was not a follow-up question, reset the checkbox for next time
  if (followUpCheckbox && !isFollowUp) {
    followUpCheckbox.checked = false;
  }
}

function processWithGemini() {
  // Reset UI for new processing
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Check if we have a file to process with
  if (!lastAudioFile) {
    alert("No audio file available for Gemini processing.");
    return;
  }

  // Grab the selected language
  const lang = document.querySelector('input[name="language"]:checked').value;
  // Get the selected question context
  const questionContext =
    document.querySelector('select[name="questionContext"]').value || "general";
  // Get the isFollowUp checkbox state
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  const isFollowUp = followUpCheckbox ? followUpCheckbox.checked : false;

  // Reset cancellation flag
  isCancelled = false;

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

  // Send the Gemini request with the audio file path
  fetch("/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioFile: lastAudioFile,
      language: lang,
      questionContext: questionContext,
      isFollowUp: isFollowUp,
    }),
  })
    .then((response) => {
      // Re-enable the recording button once the request is sent
      document.getElementById("toggleBtn").disabled = false;
    })
    .catch((error) => {
      console.error("Error sending Gemini request:", error);
      document.getElementById("loading").style.display = "none";
      document.getElementById("toggleBtn").disabled = false;
      document.getElementById("retryBtn").disabled = false;
      document.getElementById("geminiBtn").disabled = false;
      document.getElementById("cancelBtn").disabled = true;

      // Re-enable follow-up checkbox if there was an error
      if (followUpCheckbox && hasLastQuestion) {
        followUpCheckbox.disabled = false;
      }

      alert("Failed to send Gemini request: " + error.message);
    });

  // If this was not a follow-up question, reset the checkbox for next time
  if (followUpCheckbox && !isFollowUp) {
    followUpCheckbox.checked = false;
  }
}

// Add a new function to cancel recording and processing
function cancelRequest() {
  // Set the cancelled flag
  isCancelled = true;

  // Send cancel request to the server
  fetch("/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  // If we were recording, stop recording
  if (isRecording) {
    isRecording = false;
    const btn = document.getElementById("toggleBtn");
    btn.textContent = "Start Listening";
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
  document.getElementById("cancelBtn").disabled = true;

  // Clear any results that might have been displayed
  document.getElementById("question").innerHTML = "";
  document.getElementById("answer").innerHTML = "";

  // Re-enable follow-up checkbox if we have a previous question
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    followUpCheckbox.disabled = !hasLastQuestion;
  }

  // Reset animation state
  streamedContent = "";
  previousContent = "";
  animationInProgress = false;
  animationQueue = [];
}

// Animate text character by character
function animateText(element, text, startIndex, callback) {
  if (startIndex < text.length) {
    // Calculate how many characters to add in this step (variable speed typing)
    const charsToAdd = Math.floor(Math.random() * 3) + 1; // Add 1-3 characters at a time
    const nextIndex = Math.min(startIndex + charsToAdd, text.length);

    // Get the new chunk of text and wrap each character in a span for animation
    const newChars = text.substring(startIndex, nextIndex);
    let newContent = text.substring(0, startIndex);

    // Add the new characters with animation spans
    for (let i = 0; i < newChars.length; i++) {
      const delay = i * 50; // Stagger animation for each character
      newContent += `<span class="typing-char" style="animation-delay: ${delay}ms">${newChars[i]}</span>`;
    }

    // Maintain the rest of the text without animation
    newContent += text.substring(nextIndex);

    element.innerHTML = newContent;

    // Add cursor at the end
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    element.appendChild(cursor);

    // Schedule next batch with a variable delay for more natural typing
    // Make the delay depend on content type - pause longer at punctuation
    let delay = 20; // Base delay

    // Slow down at punctuation marks or new paragraph markers
    const lastChar = newChars[newChars.length - 1];
    if ([".", "!", "?", ":", ";", "\n"].includes(lastChar)) {
      delay = Math.floor(Math.random() * 250) + 200; // 200-450ms pause
    } else if ([","].includes(lastChar)) {
      delay = Math.floor(Math.random() * 150) + 100; // 100-250ms pause
    } else {
      delay = Math.floor(Math.random() * 30) + 10; // 10-40ms normal typing speed
    }

    setTimeout(() => {
      animateText(element, text, nextIndex, callback);
    }, delay);
  } else {
    // Animation complete, remove special spans and styling
    element.innerHTML = text;
    if (callback) callback();
  }
}

// Socket event handlers for streaming responses
socket.on("transcript", (data) => {
  if (isCancelled) return;

  document.getElementById(
    "question"
  ).innerHTML = `<strong>Question:</strong> ${data.transcript}`;

  // Clear any previous answer and prepare for streaming
  document.getElementById("answer").innerHTML =
    '<strong>Answer:</strong> <div id="streamingContent"></div>';

  // Reset animation state
  previousContent = "";
  streamedContent = "";
  animationQueue = [];
  animationInProgress = false;
});

socket.on("streamStart", (data) => {
  if (isCancelled) return;

  // Reset streaming content
  streamedContent = "";
  previousContent = "";

  // Clear any previous answer and prepare for streaming
  document.getElementById("answer").innerHTML =
    '<strong>Answer:</strong> <div id="streamingContent" class="stream-active"></div>';

  // Show that we're now processing the answer
  const loading = document.getElementById("loading");
  loading.innerHTML =
    '<div class="loader"></div><span>Generating answer...</span>';
  loading.style.display = "block";
});

socket.on("streamChunk", (data) => {
  if (isCancelled) return;

  // Add the new chunk to the total content
  streamedContent += data.chunk;

  // Apply markdown formatting to the entire content
  const formattedContent = marked.parse(streamedContent);

  // If the queue is getting too large, keep only the latest 5 items
  // This prevents memory issues and reduces flashing from processing too many updates
  if (animationQueue.length > 5) {
    animationQueue = animationQueue.slice(-4);
  }

  // Add the new formatted content to the queue
  animationQueue.push(formattedContent);

  // If we're not already animating, start the animation
  if (!animationInProgress) {
    processNextAnimation();
  }
});

// Process the next animation in the queue
function processNextAnimation() {
  if (animationQueue.length === 0) {
    animationInProgress = false;
    return;
  }

  animationInProgress = true;
  const nextContent = animationQueue.shift();

  // Get the container element
  const contentElement = document.getElementById("streamingContent");

  // Handle initial content
  if (!contentElement.innerHTML.trim()) {
    // For the first content update, we can set it directly but wrapped in a div
    // to ensure proper styling and animations
    const contentWrapper = document.createElement("div");
    contentWrapper.classList.add("animated-content");
    contentWrapper.innerHTML = nextContent;
    contentElement.appendChild(contentWrapper);

    // Add a subtle entrance animation for the initial content
    contentWrapper.style.animation = "smoothFadeIn 0.3s ease-in-out";

    // Add the cursor element at the end
    appendCursor(contentElement);

    // If there are more animations, process the next one
    if (animationQueue.length > 0) {
      setTimeout(processNextAnimation, 50);
    } else {
      animationInProgress = false;
    }
    return;
  }

  // Parse both current and new content to detect differences
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = nextContent;

  // Handle the content update with minimal DOM changes
  updateContentSmoothly(contentElement, tempDiv);

  // If there are more animations in the queue, process the next one with a variable delay
  // Use a longer delay if we have substantial changes (to make it easier to read)
  const contentChanged = contentElement.innerHTML !== tempDiv.innerHTML;
  const delayTime = contentChanged ? 100 : 30; // Longer delay for bigger changes

  if (animationQueue.length > 0) {
    setTimeout(processNextAnimation, delayTime);
  } else {
    animationInProgress = false;
  }
}

// Update content with minimal DOM changes to reduce flashing
function updateContentSmoothly(currentElement, newContentElement) {
  // Identify and update only the changed parts
  // This function tries to be smart about updating only what has changed

  // Find all top-level elements in both current and new content
  const currentChildren = Array.from(currentElement.children);
  const newChildren = Array.from(newContentElement.children);

  // If new content has more elements than current content
  // Just append the new elements with a fade-in animation
  if (newChildren.length > currentChildren.length) {
    for (let i = currentChildren.length; i < newChildren.length; i++) {
      const newNode = newChildren[i].cloneNode(true);
      newNode.classList.add("new-content");
      currentElement.appendChild(newNode);
    }
  }

  // Update existing elements with their new content
  // This keeps the DOM structure intact and reduces flashing
  for (
    let i = 0;
    i < Math.min(currentChildren.length, newChildren.length);
    i++
  ) {
    if (currentChildren[i].tagName === newChildren[i].tagName) {
      // Only update if content has changed
      if (currentChildren[i].innerHTML !== newChildren[i].innerHTML) {
        // For code blocks, we need special treatment
        if (currentChildren[i].tagName === "PRE") {
          updateCodeBlock(currentChildren[i], newChildren[i]);
        } else {
          currentChildren[i].innerHTML = newChildren[i].innerHTML;
        }
      }
    } else {
      // If tag types are different, replace the element
      const newNode = newChildren[i].cloneNode(true);
      newNode.classList.add("new-content");
      currentElement.replaceChild(newNode, currentChildren[i]);
    }
  }

  // Add cursor at the end
  appendCursor(currentElement);
}

// Special handling for code blocks to make them animate smoothly
function updateCodeBlock(currentBlock, newBlock) {
  // Preserve scroll position and other attributes
  const wasScrolled = currentBlock.scrollTop > 0;
  const scrollTop = currentBlock.scrollTop;

  // Update content
  currentBlock.innerHTML = newBlock.innerHTML;

  // Restore scroll position if needed
  if (wasScrolled) {
    currentBlock.scrollTop = scrollTop;
  }
}

// Add a blinking cursor at the end of the content
function appendCursor(element) {
  // Remove any existing cursors
  const existingCursors = element.querySelectorAll(".typing-cursor");
  existingCursors.forEach((cursor) => cursor.remove());

  // Find the last text-containing element to append the cursor to
  let lastElement = element;

  // Try to find the last paragraph, list item, or code block
  const possibleTargets = element.querySelectorAll(
    "p, li, pre, h1, h2, h3, h4, h5, h6"
  );
  if (possibleTargets.length > 0) {
    lastElement = possibleTargets[possibleTargets.length - 1];
  }

  // Create and append the cursor
  const cursor = document.createElement("span");
  cursor.className = "typing-cursor";
  lastElement.appendChild(cursor);
}

socket.on("streamEnd", (data) => {
  if (isCancelled) {
    isCancelled = false;
    return;
  }

  // Hide the loading indicator
  document.getElementById("loading").style.display = "none";

  // Update the main status to idle when streaming is complete
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Process any remaining animations
  if (animationQueue.length > 0) {
    // Expedite processing by collapsing to just the final state
    // This ensures we don't have a long wait if many chunks are queued
    const finalContent = animationQueue[animationQueue.length - 1];
    animationQueue = []; // Clear the queue

    // Update to final content
    const contentElement = document.getElementById("streamingContent");
    contentElement.innerHTML = finalContent;
  }

  // Final content cleanup - remove animation classes and cursor
  const contentElement = document.getElementById("streamingContent");
  contentElement.querySelectorAll(".new-content").forEach((el) => {
    el.classList.remove("new-content");
  });

  // Remove any cursors
  contentElement.querySelectorAll(".typing-cursor").forEach((cursor) => {
    cursor.remove();
  });

  // Enable retry and Gemini buttons when streaming is complete
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;

  // Disable cancel button
  document.getElementById("cancelBtn").disabled = true;

  // Store audio file reference if provided
  if (data.audioFile) {
    lastAudioFile = data.audioFile;
  }

  // Enable follow-up checkbox if we have a valid transcript
  if (data.transcript && data.transcript.trim() !== "") {
    hasLastQuestion = true;
    updateFollowUpCheckbox(data.isFollowUp);
  }

  // Reset animation state
  animationInProgress = false;
  animationQueue = [];
});

socket.on("streamError", (data) => {
  if (isCancelled) {
    isCancelled = false;
    return;
  }

  // Hide the loading indicator
  document.getElementById("loading").style.display = "none";
  console.error("Streaming error:", data.error);

  // Update the main status to error
  const status = document.getElementById("status");
  status.className = "status idle";
  status.textContent = "Status: Idle";

  // Enable retry and Gemini buttons
  document.getElementById("retryBtn").disabled = false;
  document.getElementById("geminiBtn").disabled = false;

  // Disable cancel button
  document.getElementById("cancelBtn").disabled = true;
});

// Helper function to update the follow-up checkbox state
function updateFollowUpCheckbox(isFollowUp) {
  const followUpCheckbox = document.getElementById("isFollowUpCheckbox");
  if (followUpCheckbox) {
    // Enable the checkbox if we have a previous question
    followUpCheckbox.disabled = !hasLastQuestion;

    // Always uncheck the checkbox after a response is given
    // This ensures it's unchecked for the next question
    followUpCheckbox.checked = false;

    // Log the state for debugging
    console.log(
      `Updated follow-up checkbox: disabled=${followUpCheckbox.disabled}, checked=${followUpCheckbox.checked}, hasLastQuestion=${hasLastQuestion}`
    );
  }
}
