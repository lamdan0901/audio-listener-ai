/**
 * Audio Recorder Test Module
 * 
 * This module provides a simple way to test audio recording functionality
 * directly in the browser console.
 */

// Test state
let testMediaRecorder = null;
let testRecordingStream = null;
let testAudioChunks = [];
let testAudioBlob = null;
let testAudioUrl = null;

/**
 * Check which MIME types are supported by the browser
 */
function checkSupportedMimeTypes() {
  const mimeTypes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav'
  ];
  
  console.log('Checking supported MIME types:');
  mimeTypes.forEach(type => {
    const isSupported = MediaRecorder.isTypeSupported(type);
    console.log(`${type}: ${isSupported ? 'Supported' : 'Not supported'}`);
  });
}

/**
 * Start a test recording
 */
async function startTestRecording() {
  try {
    console.log('Starting test recording...');
    
    // Reset audio chunks
    testAudioChunks = [];
    
    // Set up audio constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
    
    console.log('Requesting microphone access...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    testRecordingStream = stream;
    
    // Get supported MIME type
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    }
    
    // Create MediaRecorder
    testMediaRecorder = new MediaRecorder(stream, { mimeType });
    console.log(`MediaRecorder created with MIME type: ${testMediaRecorder.mimeType}`);
    
    // Set up event handlers
    testMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log(`Received audio chunk: ${event.data.size} bytes`);
        testAudioChunks.push(event.data);
      } else {
        console.warn('Received empty audio chunk');
      }
    };
    
    testMediaRecorder.onstart = () => {
      console.log('MediaRecorder started');
    };
    
    testMediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped');
      
      // Create audio blob
      testAudioBlob = new Blob(testAudioChunks, { type: testMediaRecorder.mimeType });
      console.log(`Audio blob created: ${testAudioBlob.size} bytes`);
      
      // Create audio URL
      if (testAudioUrl) {
        URL.revokeObjectURL(testAudioUrl);
      }
      testAudioUrl = URL.createObjectURL(testAudioBlob);
      console.log(`Audio URL created: ${testAudioUrl}`);
      
      // Stop tracks
      if (testRecordingStream) {
        testRecordingStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}`);
          track.stop();
        });
      }
      
      console.log('Test recording completed. Use playTestRecording() to play it.');
    };
    
    testMediaRecorder.onerror = (event) => {
      console.error(`MediaRecorder error: ${event.error}`);
    };
    
    // Start recording with timeslice to get data every second
    testMediaRecorder.start(1000);
    console.log('Test recording started. Use stopTestRecording() to stop it.');
    
  } catch (error) {
    console.error(`Error starting test recording: ${error.message}`);
  }
}

/**
 * Stop the test recording
 */
function stopTestRecording() {
  if (testMediaRecorder && testMediaRecorder.state !== 'inactive') {
    console.log('Stopping test recording...');
    
    // Request final data chunk
    if (testMediaRecorder.state === 'recording') {
      console.log('Requesting final data chunk');
      testMediaRecorder.requestData();
    }
    
    // Stop recording
    testMediaRecorder.stop();
  } else {
    console.log('No active test recording to stop');
  }
}

/**
 * Play the test recording
 */
function playTestRecording() {
  if (testAudioUrl) {
    console.log('Playing test recording...');
    
    // Create audio element
    const audio = new Audio(testAudioUrl);
    audio.onended = () => console.log('Test playback ended');
    audio.onplay = () => console.log('Test playback started');
    audio.onerror = (e) => console.error('Test playback error:', e);
    
    // Play audio
    audio.play();
  } else {
    console.log('No test recording to play');
  }
}

/**
 * Download the test recording
 */
function downloadTestRecording() {
  if (testAudioBlob) {
    console.log('Downloading test recording...');
    
    // Create download link
    const a = document.createElement('a');
    a.href = testAudioUrl;
    a.download = `test-recording-${Date.now()}.${testMediaRecorder.mimeType.split('/')[1].split(';')[0]}`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    console.log('No test recording to download');
  }
}

/**
 * Get information about the audio system
 */
function getAudioSystemInfo() {
  console.log('Audio System Information:');
  console.log('- User Agent:', navigator.userAgent);
  console.log('- Platform:', navigator.platform);
  
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
        console.log(`- Audio Input Devices: ${audioInputDevices.length}`);
        audioInputDevices.forEach((device, index) => {
          console.log(`  ${index + 1}. ${device.label || 'Unnamed Device'} (${device.deviceId})`);
        });
      })
      .catch(err => {
        console.error('Error enumerating devices:', err);
      });
  } else {
    console.log('- Media Devices API not available');
  }
  
  // Check if MediaRecorder is available
  if (typeof MediaRecorder !== 'undefined') {
    console.log('- MediaRecorder API: Available');
    checkSupportedMimeTypes();
  } else {
    console.log('- MediaRecorder API: Not available');
  }
}

// Export functions for use in the browser console
window.audioRecorderTest = {
  checkSupportedMimeTypes,
  startTestRecording,
  stopTestRecording,
  playTestRecording,
  downloadTestRecording,
  getAudioSystemInfo
};

console.log('Audio Recorder Test module loaded. Use window.audioRecorderTest to access test functions.');
console.log('Example: window.audioRecorderTest.getAudioSystemInfo()');
