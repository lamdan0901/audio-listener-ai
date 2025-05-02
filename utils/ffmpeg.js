const { spawn } = require("child_process");
const { tryCatch } = require("../lib/tryCatch");
const { cleanupAudioFiles } = require("./audio-processor");

/**
 * Get FFmpeg command arguments based on platform
 */
function getFfmpegArgs(outputFile, options = {}) {
  const args = ["-y", "-hide_banner"];
  // Default options with fallbacks
  const settings = {
    duration: options.duration || 90,
  };

  console.log(`Recording settings: Duration=${settings.duration}s`);

  // Configure platform-specific settings
  switch (process.platform) {
    case "win32":
      // On Windows, use a more reliable approach
      // Set higher log level to help with debugging
      args.push("-loglevel", "info");

      // Try to use virtual-audio-capturer which is common for system audio
      console.log("Attempting to use Windows virtual-audio-capturer");
      args.push(
        "-f",
        "dshow",
        "-rtbufsize",
        "100M", // Use a larger buffer for more reliability
        "-i",
        "audio=virtual-audio-capturer",
        "-sample_rate",
        "16000",
        "-channels",
        "1"
      );
      break;
    case "linux":
      args.push("-loglevel", "error");
      args.push("-f", "pulse", "-i", "default");
      break;
    default:
      args.push("-loglevel", "error");
      throw new Error("Unsupported platform");
  }

  // Set standard audio settings with 16000 Hz sample rate
  args.push(
    "-ac",
    "1",
    "-ar",
    "16000", // Standard sample rate for speech recognition
    "-acodec",
    "pcm_s16le",
    "-t",
    settings.duration.toString(),
    outputFile
  );

  return args;
}

/**
 * Check if FFmpeg is available in the system
 */
function checkFFmpegAvailability() {
  return tryCatch(
    new Promise((resolve, reject) => {
      const result = spawn("ffmpeg", ["-version"]);

      result.on("error", (err) => {
        console.error("FFmpeg not available:", err.message);
        console.error(
          "Please ensure FFmpeg is installed and available in your PATH"
        );
        process.exit(1);
      });

      result.stderr.on("data", (data) => {
        console.error(`FFmpeg check stderr: ${data}`);
      });

      result.stdout.on("data", (data) => {
        console.log(`FFmpeg available: ${data.toString().split("\n")[0]}`);
        resolve(true);
      });

      result.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`FFmpeg check exited with code ${code}`));
        }
      });
    })
  ).then((result) => {
    if (result.error) {
      console.error("FFmpeg check failed:", result.error.message);
      console.error(
        "Please ensure FFmpeg is installed and available in your PATH"
      );
      process.exit(1);
    }
    return result.data;
  });
}

module.exports = {
  getFfmpegArgs,
  checkFFmpegAvailability,
  cleanupAudioFiles,
};
