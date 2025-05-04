/**
 * Native Audio Recording Test
 * 
 * This script tests audio recording using the node-microphone package
 * which directly accesses the system's audio devices without using the browser APIs.
 * 
 * To use this script:
 * 1. Install required packages: npm install node-microphone speaker fs
 * 2. Run the script: node native-audio-test.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('Native Audio Recording Test');
console.log('==========================');

// Check if ffmpeg is available
function checkFfmpeg() {
  return new Promise((resolve, reject) => {
    console.log('Checking if ffmpeg is installed...');
    
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    ffmpeg.on('error', (err) => {
      console.error('Error: ffmpeg is not installed or not in PATH');
      console.error('Please install ffmpeg to use this test script');
      reject(err);
    });
    
    ffmpeg.stdout.on('data', (data) => {
      console.log('ffmpeg is installed:');
      console.log(data.toString().split('\n')[0]);
      resolve(true);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`ffmpeg check exited with code ${code}`));
      }
    });
  });
}

// Record audio using ffmpeg
function recordAudio(duration = 5, outputFile = 'test-recording.wav') {
  return new Promise((resolve, reject) => {
    console.log(`Recording audio for ${duration} seconds...`);
    
    // Create ffmpeg command to record audio
    const ffmpeg = spawn('ffmpeg', [
      '-y',                // Overwrite output file if it exists
      '-f', 'dshow',       // Use DirectShow for input (Windows)
      '-i', 'audio=Microphone', // Use default microphone
      '-t', duration.toString(), // Duration in seconds
      '-ar', '16000',      // Sample rate: 16kHz
      '-ac', '1',          // Channels: mono
      '-acodec', 'pcm_s16le', // Codec: PCM 16-bit
      outputFile           // Output file
    ]);
    
    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg outputs progress to stderr
      console.log(data.toString());
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Recording saved to ${outputFile}`);
        resolve(outputFile);
      } else {
        reject(new Error(`ffmpeg recording failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error('Error starting recording:', err);
      reject(err);
    });
    
    // Show a countdown
    let timeLeft = duration;
    const interval = setInterval(() => {
      console.log(`Recording... ${timeLeft} seconds left`);
      timeLeft--;
      
      if (timeLeft < 0) {
        clearInterval(interval);
      }
    }, 1000);
  });
}

// Play audio using ffplay
function playAudio(inputFile) {
  return new Promise((resolve, reject) => {
    console.log(`Playing audio file: ${inputFile}`);
    
    const ffplay = spawn('ffplay', [
      '-nodisp',           // No display
      '-autoexit',         // Exit when done
      '-i', inputFile      // Input file
    ]);
    
    ffplay.stderr.on('data', (data) => {
      console.log(data.toString());
    });
    
    ffplay.on('close', (code) => {
      if (code === 0) {
        console.log('Playback finished');
        resolve();
      } else {
        reject(new Error(`ffplay failed with code ${code}`));
      }
    });
    
    ffplay.on('error', (err) => {
      console.error('Error playing audio:', err);
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    // Check if ffmpeg is installed
    await checkFfmpeg();
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'recordings');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Generate output filename
    const outputFile = path.join(outputDir, `recording-${Date.now()}.wav`);
    
    // Record audio
    console.log('Starting audio recording...');
    console.log('Please speak into your microphone.');
    const recordedFile = await recordAudio(5, outputFile);
    
    // Check if file exists and has content
    const stats = fs.statSync(recordedFile);
    console.log(`Recording file size: ${stats.size} bytes`);
    
    if (stats.size < 1000) {
      console.warn('Warning: Recording file is very small, might be empty or corrupted');
    }
    
    // Play the recorded audio
    console.log('Playing back the recording...');
    await playAudio(recordedFile);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main();
