// Socket event handlers

function initSocketHandlers(socket) {
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

    // Save the original question for potential Gemini processing
    if (!data.processedWithGemini) {
      originalQuestion = data.transcript;
    }

    // Use the original question if this is a Gemini processed result
    const displayQuestion =
      data.processedWithGemini && originalQuestion
        ? originalQuestion
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

    // Display question immediately
    document.getElementById(
      "question"
    ).innerHTML = `<strong>Question:</strong> ${formattedQuestion}`;

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
    if (displayQuestion && displayQuestion.trim() !== "") {
      hasLastQuestion = true;
      updateFollowUpCheckbox(data.isFollowUp);
    }

    // Save to history - use the displayed question instead of the transcript
    if (displayQuestion && data.answer) {
      saveToHistory(formattedQuestion.replace(/<br>/g, " "), data.answer);
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

  // Socket event handlers for streaming responses
  socket.on("transcript", (data) => {
    if (isCancelled) return;

    // Save the original question for potential Gemini processing
    if (!data.processedWithGemini) {
      originalQuestion = data.transcript;
    }

    // Use the original question if this is a Gemini processed result
    const displayQuestion =
      data.processedWithGemini && originalQuestion
        ? originalQuestion
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

    document.getElementById(
      "question"
    ).innerHTML = `<strong>Question:</strong> ${formattedQuestion}`;

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

    // Use the original question if this is a Gemini processed result
    const displayQuestion =
      data.processedWithGemini && originalQuestion
        ? originalQuestion
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

    // Enable follow-up checkbox if we have a valid transcript
    if (displayQuestion && displayQuestion.trim() !== "") {
      hasLastQuestion = true;
      updateFollowUpCheckbox(data.isFollowUp);
    }

    // Save to history - use the displayed question instead of the transcript
    if (displayQuestion && data.fullAnswer) {
      saveToHistory(formattedQuestion.replace(/<br>/g, " "), data.fullAnswer);
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
}
