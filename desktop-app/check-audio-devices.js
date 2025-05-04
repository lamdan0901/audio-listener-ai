/**
 * Check Audio Devices
 * 
 * This script lists all audio input and output devices on the system
 * using ffmpeg's device enumeration capabilities.
 */

const { spawn } = require('child_process');

console.log('Checking Audio Devices');
console.log('=====================');

// Function to list audio devices using ffmpeg
function listAudioDevices() {
  return new Promise((resolve, reject) => {
    console.log('Listing audio devices using ffmpeg...');
    
    // On Windows, use DirectShow
    const ffmpeg = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    
    let output = '';
    
    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg outputs device list to stderr
      const chunk = data.toString();
      output += chunk;
      console.log(chunk);
    });
    
    ffmpeg.on('close', (code) => {
      // ffmpeg will exit with non-zero code, but that's expected
      resolve(output);
    });
    
    ffmpeg.on('error', (err) => {
      console.error('Error running ffmpeg:', err);
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    console.log('System information:');
    console.log('- OS:', process.platform);
    console.log('- Node.js version:', process.version);
    
    // List audio devices
    await listAudioDevices();
    
    console.log('\nDevice check completed.');
    
  } catch (error) {
    console.error('Error checking audio devices:', error);
  }
}

// Run the main function
main();
