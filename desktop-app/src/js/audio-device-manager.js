/**
 * Audio Device Manager
 *
 * This module handles the audio device selection functionality.
 */

// Initialize device selection on page load
document.addEventListener("DOMContentLoaded", initializeAudioDevices);

/**
 * Initialize the audio device selection dropdown
 */
async function initializeAudioDevices() {
  console.log("Initializing audio device selection...");
  await refreshAudioDevices();
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

// Export functions for global use
window.refreshAudioDevices = refreshAudioDevices;
window.selectAudioDevice = selectAudioDevice;

console.log("Audio device manager loaded");
