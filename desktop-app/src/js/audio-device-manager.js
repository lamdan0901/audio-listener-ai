/**
 * Audio Device Manager
 *
 * This module handles the audio device and source selection functionality.
 */

// Track the current audio source
let currentAudioSource = "microphone"; // Default to microphone

// Initialize device selection on page load
document.addEventListener("DOMContentLoaded", initializeAudioDevices);

/**
 * Check if system audio capture is supported in this environment
 * @returns {boolean} - True if system audio capture is supported
 */
function isSystemAudioSupported() {
  // First check if the API is available
  const apiAvailable = !!(
    navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia
  );

  // Then check if we're in an Electron environment
  const isElectron =
    window.navigator.userAgent.toLowerCase().indexOf("electron") > -1;

  // If we're in Electron and have our custom API, use that to check support
  if (
    isElectron &&
    window.electronAPI &&
    window.electronAPI.isSystemAudioCaptureSupported
  ) {
    const isSupported = window.electronAPI.isSystemAudioCaptureSupported();
    console.log(
      `Electron reports system audio capture supported: ${isSupported}`
    );

    if (isSupported) {
      console.log(
        "System audio capture is supported via Electron's desktopCapturer"
      );
    }

    return isSupported;
  }

  // For non-Electron environments or older Electron versions
  if (isElectron) {
    console.log(
      "Detected Electron environment but no custom API - system audio capture may not be fully supported"
    );

    // We'll still return true if the API is available, but we'll show a warning
    if (apiAvailable) {
      console.log(
        "getDisplayMedia API is available, but may not support system audio in standard Electron"
      );
    }
  }

  return apiAvailable;
}

/**
 * Initialize the audio device selection dropdown
 */
async function initializeAudioDevices() {
  console.log("Initializing audio device selection...");
  await refreshAudioDevices();

  // Set default audio source
  selectAudioSource("microphone");

  // Check if system audio is supported and update UI accordingly
  const systemAudioOption = document.querySelector(
    'input[name="audioSource"][value="system"]'
  );
  if (systemAudioOption) {
    // Check if we're in Electron
    const isElectron =
      window.navigator.userAgent.toLowerCase().indexOf("electron") > -1;

    if (!isSystemAudioSupported()) {
      // Disable the system audio option if not supported
      systemAudioOption.disabled = true;
      systemAudioOption.parentElement.title =
        "System audio capture is not supported in this browser";
      systemAudioOption.parentElement.style.opacity = "0.5";
      console.warn("System audio capture is not supported in this browser");
    } else {
      console.log("System audio capture is supported");

      // Add a note about limitations in desktop apps
      if (isElectron) {
        // Create a note element if it doesn't exist
        let noteElement = document.getElementById("system-audio-note");
        if (!noteElement) {
          noteElement = document.createElement("div");
          noteElement.id = "system-audio-note";
          noteElement.className = "note";
          noteElement.style.fontSize = "0.8em";
          noteElement.style.color = "#666";
          noteElement.style.marginTop = "5px";
          noteElement.style.marginBottom = "10px";

          // Insert after the audio source selection
          const audioSourceDiv = document.getElementById(
            "audio-source-selection"
          );
          if (audioSourceDiv) {
            audioSourceDiv.parentNode.insertBefore(
              noteElement,
              audioSourceDiv.nextSibling
            );
          }
        }

        // Set the note text based on whether we have the enhanced Electron support
        if (
          !(
            window.electronAPI &&
            window.electronAPI.isSystemAudioCaptureSupported &&
            window.electronAPI.isSystemAudioCaptureSupported()
          )
        ) {
          noteElement.textContent =
            "Note: System audio capture may not work in desktop apps. If it fails, it will automatically fall back to microphone.";
        }
      }
    }
  }
}

/**
 * Refresh the list of available audio devices
 */
async function refreshAudioDevices() {
  try {
    console.log("Refreshing audio devices...");

    const deviceSelect = document.getElementById("audioDeviceSelect");
    if (!deviceSelect) {
      console.error("Audio device select element not found");
      return;
    }

    // Clear existing options
    deviceSelect.innerHTML = '<option value="">Loading devices...</option>';

    // Request permission if needed (this will prompt the user)
    try {
      // Quick request for permission that we'll immediately stop
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      console.log("Microphone permission granted");
    } catch (err) {
      console.warn("Could not get microphone permission:", err);
      deviceSelect.innerHTML =
        '<option value="">Error: No microphone access</option>';
      return;
    }

    // Get devices from the audio recorder
    const devices = await window.audioRecorder.getAudioDevices();

    // Clear the loading option
    deviceSelect.innerHTML = "";

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Default Microphone";
    deviceSelect.appendChild(defaultOption);

    // Add options for each device
    if (devices.length > 0) {
      devices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent =
          device.label || `Microphone (${device.deviceId.substring(0, 8)}...)`;
        deviceSelect.appendChild(option);
      });
      console.log(
        `Added ${devices.length} audio devices to selection dropdown`
      );
    } else {
      console.warn("No audio input devices found");
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No devices found";
      option.disabled = true;
      deviceSelect.appendChild(option);
    }

    // Check if we have a previously selected device
    const currentDevice = window.audioRecorder.getSelectedAudioDevice();
    if (currentDevice) {
      // Try to select it in the dropdown
      deviceSelect.value = currentDevice;

      // If the device is no longer available, reset to default
      if (deviceSelect.value !== currentDevice) {
        console.warn(
          `Previously selected device ${currentDevice} is no longer available`
        );
        window.audioRecorder.setAudioDevice(null);
      }
    }
  } catch (error) {
    console.error("Error refreshing audio devices:", error);

    // Show error in dropdown
    const deviceSelect = document.getElementById("audioDeviceSelect");
    if (deviceSelect) {
      deviceSelect.innerHTML =
        '<option value="">Error loading devices</option>';
    }
  }
}

/**
 * Select an audio device for recording
 * @param {string} deviceId - The device ID to use
 */
function selectAudioDevice(deviceId) {
  console.log(`User selected audio device: ${deviceId}`);

  // If empty string, use default device
  if (deviceId === "") {
    console.log("Using default audio device");
    window.audioRecorder.setAudioDevice(null);
  } else {
    window.audioRecorder.setAudioDevice(deviceId);
  }

  // Update UI to reflect selection
  const deviceSelect = document.getElementById("audioDeviceSelect");
  const selectedOption = deviceSelect.options[deviceSelect.selectedIndex];
  const deviceName = selectedOption
    ? selectedOption.textContent
    : "Unknown Device";

  console.log(`Selected device: ${deviceName}`);

  // Show a brief confirmation message
  const status = document.getElementById("status");
  if (status) {
    const originalClass = status.className;
    const originalText = status.textContent;

    status.className = "status success";
    status.textContent = `Audio device set to: ${deviceName}`;

    // Restore original status after 2 seconds
    setTimeout(() => {
      status.className = originalClass;
      status.textContent = originalText;
    }, 2000);
  }
}

// Add event listener for device changes
if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange) {
  navigator.mediaDevices.ondevicechange = () => {
    console.log("Audio devices changed, refreshing list...");
    refreshAudioDevices();
  };
}

/**
 * Select the audio source (microphone or system audio)
 * @param {string} sourceType - The source type ('microphone' or 'system')
 */
function selectAudioSource(sourceType) {
  console.log(`Selecting audio source: ${sourceType}`);

  // If trying to select system audio but it's not supported, fall back to microphone
  if (sourceType === "system" && !isSystemAudioSupported()) {
    console.warn(
      "System audio capture not supported, falling back to microphone"
    );
    sourceType = "microphone";

    // Update the radio button selection
    const micRadio = document.querySelector(
      'input[name="audioSource"][value="microphone"]'
    );
    if (micRadio) {
      micRadio.checked = true;
    }

    // Show warning to user
    const status = document.getElementById("status");
    if (status) {
      const originalClass = status.className;
      status.className = "status error";
      status.textContent =
        "System audio capture is not supported in this browser. Using microphone instead.";

      // Restore original status after 3 seconds
      setTimeout(() => {
        status.className = originalClass;
      }, 3000);
    }
  }

  // Update the current audio source
  currentAudioSource = sourceType;

  // Update UI based on selected source
  const deviceSelectionDiv = document.getElementById("audio-device-selection");

  if (sourceType === "microphone") {
    // Show device selection for microphone
    deviceSelectionDiv.style.display = "block";
    // Refresh the device list to ensure it's up to date
    refreshAudioDevices();
  } else if (sourceType === "system") {
    // Hide device selection for system audio (not applicable)
    deviceSelectionDiv.style.display = "none";
  }

  // Notify the audio recorder of the source change
  if (
    window.audioRecorder &&
    typeof window.audioRecorder.setAudioSource === "function"
  ) {
    window.audioRecorder.setAudioSource(sourceType);
  } else {
    console.warn("Audio recorder doesn't support setAudioSource method");
  }

  // Show a brief confirmation message (only if we didn't show an error)
  if (sourceType === "microphone" || isSystemAudioSupported()) {
    const status = document.getElementById("status");
    if (status) {
      const originalClass = status.className;
      const originalText = status.textContent;

      status.className = "status success";
      status.textContent = `Audio source set to: ${
        sourceType === "microphone" ? "Microphone" : "System Audio"
      }`;

      // Restore original status after 2 seconds
      setTimeout(() => {
        status.className = originalClass;
        status.textContent = originalText;
      }, 2000);
    }
  }
}

/**
 * Get the current audio source
 * @returns {string} - The current audio source ('microphone' or 'system')
 */
function getAudioSource() {
  return currentAudioSource;
}

// Export functions for global use
window.refreshAudioDevices = refreshAudioDevices;
window.selectAudioDevice = selectAudioDevice;
window.selectAudioSource = selectAudioSource;
window.getAudioSource = getAudioSource;
window.isSystemAudioSupported = isSystemAudioSupported;

console.log("Audio device manager loaded");
