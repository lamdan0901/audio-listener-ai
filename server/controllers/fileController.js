const fs = require("fs");
const path = require("path");
const {
  cleanupAudioFiles,
  convertAudioToStandardFormat,
  needsConversion,
} = require("../utils/ffmpeg");
const baseController = require("./baseController");
const { tryCatch } = require("../lib/tryCatch");
const backendEvents = require("../lib/events");

/**
 * Set up the recording directory and prepare output file
 * @returns {string} The path to the new output file
 */
function setupRecordingEnvironment() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
  }

  // Generate unique output file name
  const outputFile = `audio/${Date.now()}.wav`;
  console.log(`Starting new recording to: ${outputFile}`);

  // Update the shared state
  baseController.setCurrentOutputFile(outputFile);

  return outputFile;
}

/**
 * Clean up any existing audio files before starting a new recording
 */
function cleanupExistingAudioFiles() {
  console.log("Cleaning up existing audio files before starting new recording");
  // Delete all audio files in the audio directory
  const audioDir = path.join(__dirname, "..", "audio");
  cleanupAudioFiles(audioDir);

  // Also clean up the last processed file reference
  baseController.setLastProcessedFile(null);

  // Do NOT reset lastQuestion here - we want to maintain context between recordings
  // This allows for follow-up questions across different recording sessions
}

/**
 * Clean up the output file if it was created
 */
function cleanupOutputFile() {
  const currentOutputFile = baseController.getCurrentOutputFile();

  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    const deleteResult = tryCatch(
      Promise.resolve(fs.unlinkSync(currentOutputFile))
    );

    deleteResult.then((result) => {
      if (result.error) {
        console.error("Error deleting file:", result.error);
      } else {
        console.log(`Deleted audio file: ${currentOutputFile}`);
        baseController.setCurrentOutputFile(null);
      }
    });
  }
}

/**
 * Clean up empty output file
 */
function cleanupEmptyOutputFile() {
  const currentOutputFile = baseController.getCurrentOutputFile();

  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    const stats = fs.statSync(currentOutputFile);
    if (stats.size === 0) {
      // No data was recorded, so delete the file
      fs.unlinkSync(currentOutputFile);
      console.log(`Deleted empty audio file: ${currentOutputFile}`);
    }
  }
}

/**
 * Validate that the audio file exists and has content
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} - Path to the validated (and possibly converted) audio file
 */
async function validateAudioFile(filePath) {
  // File validation
  if (!filePath) {
    console.error("No audio file was provided");
    throw new Error("No audio file was provided");
  }

  // Check if the file exists
  console.log(`Checking if file exists: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    throw new Error("Audio file not found");
  }

  // Get file stats
  const stats = fs.statSync(filePath);
  console.log(`File size: ${stats.size} bytes`);
  console.log(`File created: ${stats.birthtime}`);
  console.log(`File modified: ${stats.mtime}`);

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  console.log(`File extension: ${ext}`);

  // Try to determine file type
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const hexSignature = buffer.toString("hex").substring(0, 8);
    console.log(`File signature (hex): ${hexSignature}`);

    // Check common audio file signatures
    if (hexSignature.startsWith("52494646")) {
      // RIFF (WAV)
      console.log("File appears to be a WAV file");
    } else if (hexSignature.startsWith("494433")) {
      // ID3 (MP3)
      console.log("File appears to be an MP3 file");
    } else if (hexSignature.startsWith("66747970")) {
      // ftyp (MP4/M4A)
      console.log("File appears to be an MP4/M4A file");
    } else if (hexSignature.startsWith("4f676753")) {
      // OggS (OGG)
      console.log("File appears to be an OGG file");
    } else {
      console.log("File signature not recognized as a common audio format");
    }
  } catch (err) {
    console.error("Error reading file signature:", err);
  }

  // Check file size - if it's empty, wait a bit and check again (could be delayed write)
  const fileStats = fs.statSync(filePath);
  console.log(`Initial file size check: ${fileStats.size} bytes`);

  if (fileStats.size === 0) {
    await waitForFileContent(filePath);
  }

  // For MP4 files from mobile, we'll try to use them directly first
  // We already have the extension from earlier in the function
  if (ext === ".mp4" || ext === ".m4a" || ext === ".mp3") {
    // Check if the file with .mp3 extension is actually an MP4 file
    if (ext === ".mp3") {
      try {
        const buffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);

        const hexSignature = buffer.toString("hex");
        if (hexSignature.includes("66747970")) {
          // "ftyp" signature for MP4
          console.log(
            "File with .mp3 extension is actually an MP4 file. Renaming..."
          );
          const newPath = filePath.replace(".mp3", ".mp4");
          fs.renameSync(filePath, newPath);
          console.log(`Renamed file to: ${newPath}`);
          return newPath;
        }
      } catch (err) {
        console.error("Error checking MP3 file format:", err);
      }
    }

    console.log(`Using mobile audio file directly: ${filePath}`);
    // We'll try to use the file as-is first, since AssemblyAI can handle MP4/M4A
    return filePath;
  }

  // For other formats, check if conversion is needed
  if (needsConversion(filePath)) {
    try {
      console.log(`File format needs conversion: ${filePath}`);
      backendEvents.emit("processing", {
        message: "Converting audio format...",
      });

      // Convert the file to a standard format
      const convertedFilePath = await convertAudioToStandardFormat(filePath);
      console.log(`File converted successfully: ${convertedFilePath}`);

      // Return the path to the converted file
      return convertedFilePath;
    } catch (error) {
      console.error(`Error converting audio file: ${error.message}`);
      // If conversion fails, continue with the original file
      console.log("Proceeding with original file format");
    }
  }

  console.log("File validation successful, proceeding with processing");
  return filePath;
}

/**
 * Wait for file to have content
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<void>}
 */
async function waitForFileContent(filePath) {
  // Give it one more chance - wait a bit longer for any delayed writes
  console.log("File is empty, waiting to see if more data arrives...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check again
  if (fs.existsSync(filePath)) {
    const newStats = fs.statSync(filePath);
    console.log(`After waiting, file size is now: ${newStats.size} bytes`);

    if (newStats.size === 0) {
      throw new Error("Recording file is empty. No audio was captured.");
    }
  } else {
    throw new Error("Recording file disappeared during processing");
  }
}

module.exports = {
  setupRecordingEnvironment,
  cleanupExistingAudioFiles,
  cleanupOutputFile,
  cleanupEmptyOutputFile,
  validateAudioFile,
  waitForFileContent,
};
