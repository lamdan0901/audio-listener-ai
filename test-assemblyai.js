/**
 * Test script for AssemblyAI API
 * This script tests the AssemblyAI API with a simple audio file
 */

require("dotenv").config();
const fs = require("fs");
const { AssemblyAI } = require("assemblyai");

// Initialize AssemblyAI client
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY,
});

async function testTranscription() {
  try {
    console.log("Testing AssemblyAI transcription...");

    // Get a test audio file
    const testFilePath = "./audio/1746500286863.mp4"; // Use an existing audio file

    // Check if file exists
    if (!fs.existsSync(testFilePath)) {
      console.error(`Test file not found: ${testFilePath}`);
      console.log("Please provide a valid audio file path");
      return;
    }

    // Read the file as a buffer
    const audioBuffer = fs.readFileSync(testFilePath);
    console.log(
      `Read audio file into buffer, size: ${audioBuffer.length} bytes`
    );

    // First, upload the audio file
    console.log("Uploading audio file to AssemblyAI...");
    const uploadResponse = await client.files.upload(audioBuffer);
    console.log("Upload successful:", uploadResponse);

    // Now transcribe the uploaded file
    console.log("Submitting transcription request...");
    console.log("Audio URL:", uploadResponse);
    const transcriptResponse = await client.transcripts.transcribe({
      audio_url: uploadResponse,
      speech_model: "universal",
    });

    console.log("Transcription submitted successfully!");
    console.log("Transcript:", transcriptResponse);

    // Wait for the transcription to complete
    console.log("Waiting for transcription to complete...");
    const transcript = await client.transcripts.waitUntilReady(
      transcriptResponse.id
    );

    console.log("Transcription completed!");
    console.log("Transcript text:", transcript.text);
  } catch (error) {
    console.error("Error testing AssemblyAI transcription:", error);
  }
}

// Run the test
testTranscription();
