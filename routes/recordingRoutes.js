const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  recordingController,
  transcriptionController,
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
  // Accept common audio formats
  if (file.mimetype.startsWith("audio/")) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"), false);
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
    await transcriptionController.stopRecording(req, res);
  });

  // Legacy retry endpoint - for backward compatibility
  router.post("/retry", async (req, res) => {
    await transcriptionController.retryTranscription(req, res);
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

    // Then process with the transcription controller
    await transcriptionController.retryTranscription(req, res);
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
