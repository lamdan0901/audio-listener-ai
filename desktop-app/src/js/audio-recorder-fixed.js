/**
 * Audio Recorder Module for Desktop App (Fixed Version)
 *
 * This module provides functionality to record audio from the user's microphone
 * using a simplified approach with the MediaRecorder API.
 * Includes support for selecting specific audio input devices.
 */

// Module state
let mediaRecorder = null;
let recordingStream = null;
let audioChunks = [];
let isRecordingActive = false;
let audioDevices = [];
let selectedDeviceId = null;

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

    // Save devices to module state
    audioDevices = audioInputDevices;

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

    // Set up audio constraints
    const constraints = { audio: true };

    // If a specific device is selected, use it
    if (selectedDeviceId) {
      console.log(`Using selected audio device: ${selectedDeviceId}`);
      constraints.audio = {
        deviceId: { exact: selectedDeviceId },
      };
    } else {
      console.log("Using default audio device");
    }

    // Request microphone access with constraints
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    recordingStream = stream;

    // Create MediaRecorder with default settings
    // Let the browser choose the best format
    mediaRecorder = new MediaRecorder(stream);

    console.log(
      `MediaRecorder created with MIME type: ${mediaRecorder.mimeType}`
    );

    // Set up event handlers for the MediaRecorder
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        console.log(`Received audio chunk: ${event.data.size} bytes`);
        audioChunks.push(event.data);
      }
    };

    // Start recording with a timeslice to get data more frequently
    mediaRecorder.start(1000);
    isRecordingActive = true;

    console.log("MediaRecorder started successfully");

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

    // Function to handle the stop event
    const handleStop = () => {
      console.log("MediaRecorder stopped");

      // Check if we have any audio chunks
      if (audioChunks.length === 0) {
        console.error("No audio chunks were recorded");
        resolve(null);
        return;
      }

      // Create a blob from the audio chunks
      // Use the MIME type from the MediaRecorder
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunks, { type: mimeType });

      console.log(
        `Audio recording completed. Blob size: ${audioBlob.size} bytes`
      );

      // Stop all tracks in the stream to release the microphone
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => track.stop());
        recordingStream = null;
      }

      // Clear recording state
      mediaRecorder = null;
      isRecordingActive = false;

      resolve(audioBlob);
    };

    // Set up the onstop handler
    mediaRecorder.onstop = handleStop;

    // Stop the recording if it's active
    if (mediaRecorder.state !== "inactive") {
      // Request final data chunk before stopping
      mediaRecorder.requestData();

      // Stop recording
      mediaRecorder.stop();
    } else {
      console.warn("MediaRecorder already stopped");
      handleStop();
    }
  });
}

/**
 * Cancels the current recording
 */
function cancelRecording() {
  console.log("Cancelling recording...");

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop());
    recordingStream = null;
  }

  mediaRecorder = null;
  audioChunks = [];
  isRecordingActive = false;

  console.log("Recording cancelled");
}

/**
 * Checks if recording is currently in progress
 * @returns {boolean} - True if recording is in progress
 */
function isRecording() {
  return isRecordingActive;
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

// Initialize by enumerating devices
getAudioDevices().then((devices) => {
  console.log(
    `Audio recorder initialized with ${devices.length} available devices`
  );

  // If devices were found with labels, it means we already have permission
  const devicesWithLabels = devices.filter((device) => device.label);
  if (devicesWithLabels.length > 0) {
    console.log("Microphone permission already granted");
  } else if (devices.length > 0) {
    console.log("Microphone permission not yet granted");
  }
});

console.log("Fixed audio recorder module loaded");
