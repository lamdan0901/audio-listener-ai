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
let audioSource = "microphone"; // Default to microphone, can be "microphone" or "system"

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
 * Sets the audio source to use for recording
 * @param {string} source - The audio source ('microphone' or 'system')
 */
function setAudioSource(source) {
  if (source !== "microphone" && source !== "system") {
    console.error(`Invalid audio source: ${source}`);
    return;
  }

  console.log(`Setting audio source: ${source}`);
  audioSource = source;
}

/**
 * Gets the currently selected audio source
 * @returns {string} - The selected audio source ('microphone' or 'system')
 */
function getAudioSource() {
  return audioSource;
}

/**
 * Starts recording audio from the selected source (microphone or system audio)
 * @returns {Promise<boolean>} - Promise resolving to true if recording started successfully
 */
async function startRecording() {
  try {
    console.log(`Starting audio recording from ${audioSource}...`);

    // Reset recording state
    audioChunks = [];

    let stream;

    // Get audio stream based on selected source
    if (audioSource === "microphone") {
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
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } else if (audioSource === "system") {
      try {
        // Check if getDisplayMedia is supported
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getDisplayMedia
        ) {
          throw new Error(
            "System audio capture is not supported in this browser"
          );
        }

        // Check if we're in Electron
        const isElectron =
          window.navigator.userAgent.toLowerCase().indexOf("electron") > -1;

        // Display a message to the user
        const status = document.getElementById("status");
        if (status) {
          status.className = "status recording";
          status.textContent = "Status: Requesting system audio...";
        }

        // If we're in Electron with our custom implementation
        if (
          isElectron &&
          window.electronAPI &&
          window.electronAPI.isSystemAudioCaptureSupported &&
          window.electronAPI.isSystemAudioCaptureSupported()
        ) {
          console.log(
            "Using Electron's desktopCapturer for system audio capture"
          );

          // Request display media with audio - this will be intercepted by our handler in main.ts
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // We need video to be true to get the system audio option
            audio: true,
          });

          // Check if we got audio tracks
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length === 0) {
            throw new Error("No system audio tracks received from Electron");
          }

          console.log(
            `Received ${audioTracks.length} audio tracks from system`
          );

          // We only need the audio tracks, stop the video tracks
          displayStream.getVideoTracks().forEach((track) => {
            console.log(`Stopping video track: ${track.label}`);
            track.stop();
          });

          // Create a new stream with only audio tracks
          stream = new MediaStream(audioTracks);

          console.log("System audio capture started successfully via Electron");

          if (status) {
            status.textContent = "Status: Recording system audio...";
          }
        } else {
          // Standard browser approach (fallback)
          console.log(
            "Attempting standard system audio capture via getDisplayMedia"
          );

          // Display a message to the user about what to select
          if (status) {
            status.textContent =
              "Status: Please select 'Share system audio' in the dialog";
          }

          // Request display media with audio
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // We need video to be true to get the system audio option
            audio: true,
          });

          // Check if user selected to share audio
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length === 0) {
            // User didn't select to share audio
            console.warn(
              "No audio track found in display media. User may not have selected to share system audio."
            );

            // Clean up the video tracks we don't need
            displayStream.getVideoTracks().forEach((track) => track.stop());

            // Show error message
            if (status) {
              status.className = "status error";
              status.textContent =
                "Error: System audio not selected. Please try again and select 'Share system audio'";
            }

            throw new Error("No system audio selected");
          }

          // We only need the audio tracks, stop the video tracks
          displayStream.getVideoTracks().forEach((track) => track.stop());

          // Create a new stream with only audio tracks
          stream = new MediaStream(audioTracks);

          console.log("System audio capture started successfully");
        }
      } catch (error) {
        console.error("System audio capture error:", error.message);

        // Show error message to user
        const status = document.getElementById("status");
        if (status) {
          status.className = "status error";

          // Check if we're in Electron to provide a more specific message
          const isElectron =
            window.navigator.userAgent.toLowerCase().indexOf("electron") > -1;

          if (isElectron && error.message === "Not supported") {
            status.textContent =
              "Error: System audio capture is not supported in desktop apps. Falling back to microphone.";
          } else {
            status.textContent = `Error: ${error.message}. Falling back to microphone.`;
          }
        }

        // Fall back to microphone
        console.log("Falling back to microphone input...");
        audioSource = "microphone"; // Reset to microphone

        // Update radio buttons to reflect fallback
        const micRadio = document.querySelector(
          'input[name="audioSource"][value="microphone"]'
        );
        if (micRadio) {
          micRadio.checked = true;
        }

        // Try again with microphone
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1,
          },
        };

        // If a specific device is selected, add it to constraints
        if (selectedDeviceId) {
          console.log(`Using selected audio device: ${selectedDeviceId}`);
          constraints.audio.deviceId = { exact: selectedDeviceId };
        }

        console.log(
          "Falling back to microphone with constraints:",
          JSON.stringify(constraints)
        );
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Show device selection again since we're back to microphone
        const deviceSelectionDiv = document.getElementById(
          "audio-device-selection"
        );
        if (deviceSelectionDiv) {
          deviceSelectionDiv.style.display = "block";
        }
      }
    } else {
      throw new Error(`Invalid audio source: ${audioSource}`);
    }

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
  setAudioSource,
  getAudioSource,
};

// Initialize by trying to get device list
getAudioDevices().then((devices) => {
  console.log(
    `Audio recorder initialized with ${devices.length} available devices`
  );
});

console.log("Audio recorder module loaded");
