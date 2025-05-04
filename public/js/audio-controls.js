// Audio recording and processing functions

/**
 * Toggles the recording state on/off and updates the UI accordingly.
 * Starts or stops audio recording, sends appropriate requests to the server,
 * and manages UI elements based on the current recording state.
 */
function toggleRecording() {
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
        questionContext: questionContext,
        customContext: customContext,
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
        questionContext: questionContext,
        customContext: customContext,
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

/**
 * Retries transcription of the last recorded audio file with potentially different settings.
 * Resets UI, disables relevant buttons, and sends a retry request to the server.
 * This is useful when the initial transcription was incorrect or incomplete.
 */
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
      audioFilePath: lastAudioFile, // Corrected variable and assumed backend expects audioFilePath
      language: lang, // Corrected variable
      questionContext,
      customContext,
      isFollowUp,
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

/**
 * Processes the last recorded audio with Gemini AI instead of standard transcription.
 * Resets UI, captures the original question if available, and sends a request
 * to process the audio with Gemini AI for enhanced results.
 */
function processWithGemini() {
  // Save the current question displayed in the UI if no originalQuestion is set
  if (!originalQuestion) {
    const questionElement = document.getElementById("question");
    if (questionElement.textContent) {
      // Extract just the question part removing the "Question:" prefix
      const questionText = questionElement.textContent
        .replace(/^Question:\s*/i, "")
        .trim();
      if (questionText) {
        originalQuestion = questionText;
      }
    }
  }

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
  // Get the custom context if provided
  const customContext =
    document.getElementById("customContextInput").value || "";
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
      customContext: customContext,
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

/**
 * Cancels the current recording or processing operation.
 * Resets UI state, sends cancel request to server, and re-enables buttons.
 * Also clears any results and resets animation state.
 */
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

/**
 * Updates the follow-up checkbox state based on whether there's a previous question.
 * Enables or disables the checkbox appropriately and logs debugging information.
 */
function updateFollowUpCheckbox() {
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
