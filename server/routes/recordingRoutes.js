const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  recordingController,
  aiProcessingController,
  processingController,
} = require("../controllers");

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the audio directory exists
    const audioDir = path.join(__dirname, "..", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, "audio/");
  },
  filename: function (req, file, cb) {
    // Create a unique filename with timestamp
    const uniqueFilename = `${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

// File filter to accept only audio files
const fileFilter = (req, file, cb) => {
  console.log(
    "Received file:",
    file.originalname,
    "with mimetype:",
    file.mimetype
  );

  // Log the request headers for debugging
  console.log("Request headers:", req.headers);

  // Always accept files from mobile app (we'll validate them later)
  if (req.headers["user-agent"] && req.headers["user-agent"].includes("Expo")) {
    console.log("Accepting file from Expo mobile app");
    cb(null, true);
    return;
  }

  // Accept common audio formats
  if (file.mimetype.startsWith("audio/")) {
    console.log("Accepting audio file with mimetype:", file.mimetype);
    cb(null, true);
  }
  // Accept video/mp4 which is sometimes used for audio-only recordings on mobile
  else if (
    file.mimetype === "video/mp4" ||
    file.mimetype === "video/quicktime"
  ) {
    console.log(
      "Accepting video/mp4 or video/quicktime as audio file (common for mobile recordings)"
    );
    cb(null, true);
  }
  // Check file extension for common audio formats if mimetype is application/octet-stream
  else if (file.mimetype === "application/octet-stream") {
    const ext = file.originalname.toLowerCase().split(".").pop();
    if (["mp3", "wav", "ogg", "m4a", "aac", "mp4"].includes(ext)) {
      console.log(
        `Accepting file with extension .${ext} despite mimetype ${file.mimetype}`
      );
      cb(null, true);
    } else {
      cb(
        new Error(
          `File with extension .${ext} is not an accepted audio format`
        ),
        false
      );
    }
  } else {
    console.log("Rejected file with mimetype:", file.mimetype);
    cb(
      new Error(
        `Only audio files are allowed. Received mimetype: ${file.mimetype}`
      ),
      false
    );
  }
};

// Initialize multer with our configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
  },
});

module.exports = () => {
  // Legacy endpoint - may still be used by some clients
  router.post("/start", (req, res) => {
    recordingController.startRecording(req, res);
  });

  // New endpoint for file upload and processing
  router.post("/upload", upload.single("audio"), async (req, res) => {
    await recordingController.handleAudioUpload(req, res);
  });

  // Updated stop endpoint - now primarily for legacy support
  router.post("/stop", async (req, res) => {
    res.status(400).send("Direct audio recording stop is no longer supported.");
  });

  // Legacy retry endpoint - for backward compatibility
  // Redirects to Gemini processing as a "retry"
  router.post("/retry", async (req, res) => {
    await aiProcessingController.processWithGemini(req, res);
  });

  // New retry endpoint that accepts file uploads
  router.post("/retry-upload", upload.single("audio"), async (req, res) => {
    // First handle the file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No audio file was uploaded for retry",
      });
    }

    // Add the file path to the request body
    req.body.audioFile = req.file.path;

    // Then process with the AI processing controller
    await aiProcessingController.processWithGemini(req, res);
  });

  // Legacy Gemini endpoint - for backward compatibility
  router.post("/gemini", async (req, res) => {
    await aiProcessingController.processWithGemini(req, res);
  });

  // New Gemini endpoint that accepts file uploads
  router.post("/gemini-upload", upload.single("audio"), async (req, res) => {
    // First handle the file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No audio file was uploaded for Gemini processing",
      });
    }

    // Add the file path to the request body
    req.body.audioFile = req.file.path;

    // Then process with the AI processing controller
    await aiProcessingController.processWithGemini(req, res);
  });

  router.post("/stream", async (req, res) => {
    await aiProcessingController.streamResponse(req, res);
  });

  router.post("/cancel", async (req, res) => {
    await processingController.cancelProcessing(req, res);
  });

  router.get("/status", (req, res) => {
    res.json(recordingController.getStatus());
  });

  // New endpoint to clear audio files
  router.post("/clear-audio-files", (req, res) => {
    try {
      const fileController = require("../controllers/fileController");
      fileController.cleanupExistingAudioFiles();
      res
        .status(200)
        .json({ success: true, message: "Audio files cleared successfully" });
    } catch (error) {
      console.error("Error clearing audio files:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to clear audio files" });
    }
  });

  return router;
};
