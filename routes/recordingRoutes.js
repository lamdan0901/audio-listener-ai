const express = require("express");
const router = express.Router();
const recordingController = require("../controllers/recordingController");

module.exports = (io) => {
  router.post("/start", (req, res) => {
    recordingController.startRecording(req, res, io);
  });

  router.post("/stop", async (req, res) => {
    await recordingController.stopRecording(req, res, io);
  });

  router.post("/retry", async (req, res) => {
    await recordingController.retryTranscription(req, res, io);
  });

  router.post("/gemini", async (req, res) => {
    await recordingController.processWithGemini(req, res, io);
  });

  router.post("/stream", async (req, res) => {
    await recordingController.streamResponse(req, res, io);
  });

  router.post("/cancel", async (req, res) => {
    await recordingController.cancelProcessing(req, res, io);
  });

  router.get("/status", (req, res) => {
    res.json(recordingController.getStatus());
  });

  return router;
};
