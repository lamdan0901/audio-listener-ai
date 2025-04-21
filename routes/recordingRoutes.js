const express = require("express");
const router = express.Router();
const {
  recordingController,
  transcriptionController,
  aiProcessingController,
  processingController,
} = require("../controllers");

module.exports = (io) => {
  router.post("/start", (req, res) => {
    recordingController.startRecording(req, res, io);
  });

  router.post("/stop", async (req, res) => {
    await transcriptionController.stopRecording(req, res, io);
  });

  router.post("/retry", async (req, res) => {
    await transcriptionController.retryTranscription(req, res, io);
  });

  router.post("/gemini", async (req, res) => {
    await aiProcessingController.processWithGemini(req, res, io);
  });

  router.post("/stream", async (req, res) => {
    await aiProcessingController.streamResponse(req, res, io);
  });

  router.post("/cancel", async (req, res) => {
    await processingController.cancelProcessing(req, res, io);
  });

  router.get("/status", (req, res) => {
    res.json(recordingController.getStatus());
  });

  return router;
};
