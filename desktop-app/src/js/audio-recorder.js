/**
 * Audio Recorder Module for Desktop App
 *
 * This module provides functionality to record audio from the user's microphone
 * using the MediaRecorder API.
 */

// Module state
let mediaRecorder = null;
let recordingStream = null;
let audioChunks = [];
let selectedDeviceId = null;

/**
 * Get supported MIME types for audio recording
 * @returns {string|null} - The best supported MIME type or null if none are supported
 */
function getSupportedMimeType() {
  // List of MIME types to try, in order of preference
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "", // Empty string = browser default
  ];

  for (const type of mimeTypes) {
    if (type === "" || MediaRecorder.isTypeSupported(type)) {
      console.log(`Using MIME type: ${type || "browser default"}`);
      return type || null;
    }
  }

  console.warn("No supported MIME types found for MediaRecorder");
  return null;
}

/**
 * Enumerates available audio input devices
 * @returns {Promise<Array>} - Promise resolving to array of audio input devices
 */
async function getAudioDevices() {
  try {
    console.log("Enumerating audio input devices...");

    // Get all media devices
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Filter for audio input devices only
    const audioInputDevices = devices.filter(
      (device) => device.kind === "audioinput"
    );

    console.log(`Found ${audioInputDevices.length} audio input devices:`);
    audioInputDevices.forEach((device, index) => {
      console.log(
        `${index + 1}. ${device.label || "Unnamed Device"} (${device.deviceId})`
      );
    });

    return audioInputDevices;
  } catch (error) {
    console.error("Error enumerating audio devices:", error);
    return [];
  }
}

/**
 * Sets the audio device to use for recording
 * @param {string} deviceId - The device ID to use
 */
function setAudioDevice(deviceId) {
  console.log(`Setting audio device: ${deviceId}`);
  selectedDeviceId = deviceId;
}

/**
 * Gets the currently selected audio device ID
 * @returns {string|null} - The selected device ID or null if none selected
 */
function getSelectedAudioDevice() {
  return selectedDeviceId;
}

/**
 * Starts recording audio from the user's microphone
 * @returns {Promise<boolean>} - Promise resolving to true if recording started successfully
 */
async function startRecording() {
  try {
    console.log("Starting audio recording...");

    // Reset recording state
    audioChunks = [];

    // Request microphone access with specific constraints for better quality
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000, // 16kHz sample rate for speech recognition
        channelCount: 1, // Mono audio
      },
    };

    // If a specific device is selected, add it to constraints
    if (selectedDeviceId) {
      console.log(`Using selected audio device: ${selectedDeviceId}`);
      constraints.audio.deviceId = { exact: selectedDeviceId };
    }

    console.log(
      "Requesting microphone access with constraints:",
      JSON.stringify(constraints)
    );
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    recordingStream = stream;

    // Get the supported MIME type
    const mimeType = getSupportedMimeType();

    // Create MediaRecorder instance with options
    const options = {};
    if (mimeType) {
      options.mimeType = mimeType;
    }

    console.log(
      "Creating MediaRecorder with options:",
      JSON.stringify(options)
    );
    mediaRecorder = new MediaRecorder(stream, options);

    // Set up event handlers for the MediaRecorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log(`Received audio chunk: ${event.data.size} bytes`);
        audioChunks.push(event.data);
      } else {
        console.warn("Received empty audio chunk");
      }
    };

    // Add additional event handlers for better debugging
    mediaRecorder.onstart = () => {
      console.log("MediaRecorder started recording");
      // Update UI when recording starts
      if (typeof window.updateGlobalRecordingButtons === "function") {
        window.updateGlobalRecordingButtons();
      }
    };

    mediaRecorder.onpause = () => {
      console.log("MediaRecorder paused");
      // Update UI when recording pauses
      if (typeof window.updateGlobalRecordingButtons === "function") {
        window.updateGlobalRecordingButtons();
      }
    };

    mediaRecorder.onresume = () => {
      console.log("MediaRecorder resumed");
      // Update UI when recording resumes
      if (typeof window.updateGlobalRecordingButtons === "function") {
        window.updateGlobalRecordingButtons();
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      // Update UI when recording errors
      if (typeof window.updateGlobalRecordingButtons === "function") {
        window.updateGlobalRecordingButtons();
      }
    };

    // Start recording with a timeslice to get data more frequently
    // This ensures we get audio chunks every 1000ms (1 second)
    mediaRecorder.start(1000);
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

    // Request a final chunk of data before stopping
    if (mediaRecorder.state === "recording") {
      console.log("Requesting final data chunk before stopping");
      mediaRecorder.requestData();
    }

    // Define what happens when recording stops
    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped");

      // Update UI when recording stops
      if (typeof window.updateGlobalRecordingButtons === "function") {
        window.updateGlobalRecordingButtons();
      }

      // Check if we have any audio chunks
      if (audioChunks.length === 0) {
        console.error("No audio chunks were recorded");
        resolve(null);
        return;
      }

      console.log(`Creating audio blob from ${audioChunks.length} chunks`);

      // Get the MIME type from the MediaRecorder
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      console.log(`Using MIME type for blob: ${mimeType}`);

      // Create a blob from the audio chunks
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      console.log(
        `Audio recording completed. Blob size: ${audioBlob.size} bytes`
      );

      // Log warning if the blob is suspiciously small
      if (audioBlob.size < 1000) {
        console.warn(
          `Warning: Audio blob is very small (${audioBlob.size} bytes)`
        );
      }

      // Stop all tracks in the stream to release the microphone
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => {
          console.log(`Stopping audio track: ${track.kind}`);
          track.stop();
        });
        recordingStream = null;
      }

      // Clear recording state
      mediaRecorder = null;

      // Don't clear audioChunks here, keep them for debugging if needed
      // We'll clear them at the start of the next recording

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
  console.log("Cancelling recording...");

  try {
    // Stop the MediaRecorder if it's active
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      console.log(
        `Stopping MediaRecorder (current state: ${mediaRecorder.state})`
      );
      mediaRecorder.stop();
    } else if (mediaRecorder) {
      console.log(
        `MediaRecorder already inactive (state: ${mediaRecorder.state})`
      );
    } else {
      console.log("No MediaRecorder instance to cancel");
    }
  } catch (error) {
    console.error("Error stopping MediaRecorder:", error);
  }

  try {
    // Stop all tracks in the stream to release the microphone
    if (recordingStream) {
      console.log("Stopping audio tracks...");
      recordingStream.getTracks().forEach((track) => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      recordingStream = null;
    } else {
      console.log("No recording stream to stop");
    }
  } catch (error) {
    console.error("Error stopping recording stream:", error);
  }

  // Clear recording state
  mediaRecorder = null;
  audioChunks = [];

  // Update UI when recording is cancelled
  if (typeof window.updateGlobalRecordingButtons === "function") {
    window.updateGlobalRecordingButtons();
  }

  console.log("Recording cancelled successfully");
}

/**
 * Checks if recording is currently in progress
 * @returns {boolean} - True if recording is in progress
 */
function isRecording() {
  return mediaRecorder !== null && mediaRecorder.state === "recording";
}

// Export functions for use in other modules
window.audioRecorder = {
  startRecording,
  stopRecording,
  cancelRecording,
  isRecording,
  getAudioDevices,
  setAudioDevice,
  getSelectedAudioDevice,
};

// Initialize by trying to get device list
getAudioDevices().then((devices) => {
  console.log(
    `Audio recorder initialized with ${devices.length} available devices`
  );
});

console.log("Audio recorder module loaded");
