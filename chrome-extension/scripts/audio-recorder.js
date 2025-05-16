// chrome-extension/audio-recorder.js

// Global variables to store recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let permissionStatus = "unknown"; // "unknown", "granted", "denied", "dismissed", "error"

/**
 * Request tab audio capture permission
 * @returns {Promise<boolean>} - Promise resolving to true if permission is granted
 */
async function requestTabCapturePermission() {
  try {
    console.log("Checking tab capture permission...");

    // Check if permission was already granted
    if (permissionStatus === "granted") {
      console.log("Tab capture permission already granted");
      return true;
    }

    // For Chrome extensions, we need to use the chrome.permissions API
    return new Promise((resolve) => {
      // Check if we have the permission already
      chrome.permissions.contains(
        {
          permissions: ["tabCapture"],
        },
        (hasPermission) => {
          if (hasPermission) {
            console.log("Extension already has tabCapture permission");
            permissionStatus = "granted";
            resolve(true);
          } else {
            console.log("Extension doesn't have tabCapture permission");
            permissionStatus = "dismissed";
            resolve(false);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error requesting tab capture permission:", error);
    permissionStatus = "error";
    return false;
  }
}

/**
 * Get the current permission status
 * @returns {string} - Current permission status
 */
function getPermissionStatus() {
  return permissionStatus;
}

/**
 * Starts recording audio from the current browser tab
 * @returns {Promise<boolean>} - Promise resolving to true if recording started successfully
 */
async function startRecording() {
  try {
    console.log("Starting tab audio recording...");

    // Reset recording state
    audioChunks = [];

    // For Chrome extensions, we need to use the chrome.tabCapture API
    return new Promise((resolve) => {
      // First check if we have the permission
      chrome.permissions.contains(
        {
          permissions: ["tabCapture"],
        },
        (hasPermission) => {
          if (!hasPermission) {
            console.error("Extension doesn't have tabCapture permission");
            permissionStatus = "denied";
            resolve(false);
            return;
          }

          // Use chrome.tabCapture API to capture audio
          // Note: Chrome tabCapture API expects audio to be a boolean, not an object
          const constraints = {
            audio: true,
            video: false,
          };

          chrome.tabCapture.capture(constraints, (stream) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error starting tab capture:",
                chrome.runtime.lastError.message
              );
              permissionStatus = "error";
              resolve(false);
              return;
            }

            if (!stream) {
              console.error("No stream returned from tabCapture.capture");
              permissionStatus = "error";
              resolve(false);
              return;
            }

            // Check if the stream has audio tracks
            const audioTracks = stream.getAudioTracks();
            console.log(`Stream has ${audioTracks.length} audio tracks`);

            if (audioTracks.length === 0) {
              console.error("Stream does not contain any audio tracks");
              permissionStatus = "error";
              resolve(false);
              return;
            }

            // Log details about each audio track
            audioTracks.forEach((track, index) => {
              console.log(
                `Audio track ${index}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`
              );
              // Ensure track is enabled
              if (!track.enabled) {
                console.log(
                  `Enabling previously disabled audio track ${index}`
                );
                track.enabled = true;
              }
            });

            // If we get here, permission was granted
            permissionStatus = "granted";
            recordingStream = stream;

            // Create MediaRecorder instance with proper audio settings
            // Try different MIME types in order of preference
            const mimeTypes = [
              "audio/webm;codecs=opus",
              "audio/webm",
              "audio/ogg;codecs=opus",
              "audio/mp4",
            ];

            let options = null;
            let selectedMimeType = null;

            // Find the first supported MIME type
            for (const mimeType of mimeTypes) {
              if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                options = {
                  mimeType: selectedMimeType,
                  audioBitsPerSecond: 128000,
                };
                console.log(`Using supported MIME type: ${selectedMimeType}`);
                break;
              }
            }

            if (!selectedMimeType) {
              console.warn(
                "None of the preferred MIME types are supported, using browser defaults"
              );
            }

            try {
              mediaRecorder = options
                ? new MediaRecorder(stream, options)
                : new MediaRecorder(stream);
              console.log(
                "MediaRecorder created with options:",
                options || "browser defaults"
              );

              // Log MediaRecorder state and capabilities
              console.log(
                `Initial MediaRecorder state: ${mediaRecorder.state}`
              );
              console.log(`MediaRecorder mimeType: ${mediaRecorder.mimeType}`);
            } catch (e) {
              console.error("Failed to create MediaRecorder:", e);
              permissionStatus = "error";
              resolve(false);
              return;
            }

            // Set up event handlers for the MediaRecorder
            mediaRecorder.ondataavailable = (event) => {
              console.log(
                "Data available event triggered, data size:",
                event.data.size,
                "bytes, type:",
                event.data.type
              );

              // Check if we're getting valid audio data
              if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log(
                  "Audio chunk added, total chunks:",
                  audioChunks.length,
                  "total size:",
                  audioChunks.reduce((total, chunk) => total + chunk.size, 0),
                  "bytes"
                );
              } else {
                console.warn(
                  "Received empty data chunk from MediaRecorder - this may indicate no audio is being captured"
                );

                // Check if audio tracks are still active
                if (recordingStream) {
                  const audioTracks = recordingStream.getAudioTracks();
                  audioTracks.forEach((track, index) => {
                    console.log(
                      `Audio track ${index} status: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`
                    );
                  });
                }
              }
            };

            // Add error handler for MediaRecorder
            mediaRecorder.onerror = (event) => {
              console.error(
                "MediaRecorder error during recording:",
                event.error
              );
            };

            // Start recording with smaller timeslice (500ms) to get more frequent data chunks
            // This helps diagnose issues faster and ensures we get data more frequently
            mediaRecorder.start(500);

            // Set up audio level monitoring to check if we're actually getting audio
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const sourceNode = audioContext.createMediaStreamSource(stream);

            // Create a gain node to boost the signal for analysis
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 5.0; // Boost the signal for better detection

            // Connect the audio nodes: source -> gain -> analyser
            sourceNode.connect(gainNode);
            gainNode.connect(analyser);

            // Optional: Connect to destination to ensure audio is routed through the system
            // Note: This may cause feedback if the tab is playing audio that's being captured
            // gainNode.connect(audioContext.destination);

            analyser.fftSize = 1024; // Larger FFT size for better frequency resolution
            analyser.smoothingTimeConstant = 0.3; // Add some smoothing
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            // Initialize tracking variables
            window.lastAudioLevel = 0;
            window.hasTriedAudioDestination = false;

            // Function to check audio levels
            const checkAudioLevels = () => {
              if (!mediaRecorder || mediaRecorder.state !== "recording") return;

              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;

              // Store the current audio level for reference elsewhere
              window.lastAudioLevel = average;

              console.log(`Current audio level: ${average.toFixed(2)}`);

              if (average < 0.5) {
                console.warn("Very low or no audio detected from the tab");
                console.warn(
                  "This may indicate that the tab is not producing audio or the system is not routing audio correctly"
                );

                // Check if we need to try connecting to the audio destination
                if (average === 0 && !window.hasTriedAudioDestination) {
                  console.log(
                    "Attempting to connect to audio destination to improve routing..."
                  );
                  try {
                    gainNode.connect(audioContext.destination);
                    window.hasTriedAudioDestination = true;
                  } catch (err) {
                    console.error(
                      "Failed to connect to audio destination:",
                      err
                    );
                  }
                }
              }
            };

            // Check audio levels every second
            const audioLevelInterval = setInterval(checkAudioLevels, 1000);

            // Store the interval ID so we can clear it when recording stops
            mediaRecorder.audioLevelInterval = audioLevelInterval;

            // Add a safety check to ensure we're getting data
            setTimeout(() => {
              if (audioChunks.length === 0) {
                console.warn(
                  "No audio chunks received after 3 seconds, may indicate recording issues"
                );

                // Check audio tracks again
                const audioTracks = stream.getAudioTracks();
                console.log(
                  `After 3s: Stream has ${audioTracks.length} audio tracks`
                );
                audioTracks.forEach((track, index) => {
                  console.log(
                    `Audio track ${index} status: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`
                  );
                });
              }

              // Check if we're detecting audio levels
              if (window.lastAudioLevel === 0 || window.lastAudioLevel < 0.1) {
                console.warn(
                  "No audio level detected after 3 seconds, trying to improve capture..."
                );

                // Try connecting to audio destination if not already done
                if (!window.hasTriedAudioDestination && gainNode) {
                  console.log(
                    "Connecting to audio destination to improve routing..."
                  );
                  try {
                    gainNode.connect(audioContext.destination);
                    window.hasTriedAudioDestination = true;
                  } catch (err) {
                    console.error(
                      "Failed to connect to audio destination:",
                      err
                    );
                  }
                }
              }
            }, 3000);
            console.log("MediaRecorder started", mediaRecorder.state);

            resolve(true);
          });
        }
      );
    });
  } catch (error) {
    console.error("Error starting tab audio recording:", error);
    permissionStatus = "error";
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

    console.log("Stopping tab audio recording...");

    // Request one final chunk of data before stopping
    if (mediaRecorder.state === "recording") {
      console.log("Requesting final data chunk before stopping");
      mediaRecorder.requestData();
    }

    // Define what happens when recording stops
    mediaRecorder.onstop = () => {
      console.log(
        "MediaRecorder stopped, chunks collected:",
        audioChunks.length
      );

      if (audioChunks.length === 0) {
        console.error("No audio chunks collected during recording");
        // Try to diagnose why no chunks were collected
        console.error(
          "This may indicate that no audio was captured from the tab"
        );
        // Return null to indicate failure
        resolve(null);
        return;
      }

      // Log detailed information about each chunk before creating the blob
      console.log("Audio chunks before creating blob:");
      audioChunks.forEach((chunk, index) => {
        console.log(
          `Chunk ${index}: size=${chunk.size} bytes, type=${chunk.type}`
        );
      });

      // Get the MIME type from the MediaRecorder if available, or use a fallback
      const mimeType = mediaRecorder.mimeType || "audio/webm;codecs=opus";
      console.log(`Using MIME type for blob: ${mimeType}`);

      // Create a blob from the audio chunks with the determined MIME type
      const audioBlob = new Blob(audioChunks, {
        type: mimeType,
      });
      console.log(
        `Tab audio recording completed. Blob size: ${audioBlob.size} bytes`
      );

      // Log more details about the blob for debugging
      if (audioBlob.size < 1000) {
        console.warn("Warning: Audio blob is suspiciously small (< 1KB)");
        console.warn(
          "This may indicate that no actual audio data was captured"
        );
      }

      // Clean up the audio level monitoring interval if it exists
      if (mediaRecorder.audioLevelInterval) {
        console.log("Clearing audio level monitoring interval");
        clearInterval(mediaRecorder.audioLevelInterval);
        mediaRecorder.audioLevelInterval = null;
      }

      // Stop all tracks in the stream to release the resources
      if (recordingStream) {
        recordingStream.getTracks().forEach((track) => {
          console.log(
            `Stopping track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`
          );
          track.stop();
        });
        recordingStream = null;
      }

      // Store the chunks for debugging before clearing
      const chunkSizes = audioChunks.map((chunk) => chunk.size);
      console.log("Audio chunk sizes:", chunkSizes);

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
  // Clean up the audio level monitoring interval if it exists
  if (mediaRecorder && mediaRecorder.audioLevelInterval) {
    console.log("Clearing audio level monitoring interval");
    clearInterval(mediaRecorder.audioLevelInterval);
    mediaRecorder.audioLevelInterval = null;
  }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop());
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
  isRecording,
  requestTabCapturePermission,
  getPermissionStatus,
};
