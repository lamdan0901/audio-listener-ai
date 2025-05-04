// chrome-extension/audio-recorder.js

// Global variables to store recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

/**
 * Starts recording audio from the user's microphone
 * @returns {Promise<boolean>} - Promise resolving to true if recording started successfully
 */
async function startRecording() {
  try {
    console.log("Starting audio recording from popup...");
    
    // Reset recording state
    audioChunks = [];
    
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStream = stream;
    
    // Create MediaRecorder instance
    mediaRecorder = new MediaRecorder(stream);
    
    // Set up event handlers for the MediaRecorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Start recording
    mediaRecorder.start();
    console.log("MediaRecorder started", mediaRecorder.state);
    
    return true;
  } catch (error) {
    console.error("Error starting audio recording:", error);
    return false;
  }
}

/**
 * Stops recording and returns the audio blob
 * @returns {Promise<Blob|null>} - Promise resolving to the audio blob or null if error
 */
async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      console.error("No MediaRecorder instance found");
      resolve(null);
      return;
    }
    
    console.log("Stopping audio recording...");
    
    // Define what happens when recording stops
    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped");
      
      // Create a blob from the audio chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log(`Audio recording completed. Blob size: ${audioBlob.size} bytes`);
      
      // Stop all tracks in the stream to release the microphone
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
      }
      
      // Clear recording state
      mediaRecorder = null;
      audioChunks = [];
      
      resolve(audioBlob);
    };
    
    // Handle errors
    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      reject(event.error);
    };
    
    // Stop the recording if it's active
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      console.warn("MediaRecorder already stopped");
      resolve(null);
    }
  });
}

/**
 * Cancels the current recording
 */
function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }
  
  mediaRecorder = null;
  audioChunks = [];
  
  console.log("Recording cancelled");
}

/**
 * Checks if recording is currently in progress
 * @returns {boolean} - True if recording is in progress
 */
function isRecording() {
  return mediaRecorder !== null && mediaRecorder.state === "recording";
}

// Export the functions
window.audioRecorder = {
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording
};
