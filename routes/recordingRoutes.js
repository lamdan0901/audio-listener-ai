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

  router.get("/status", (req, res) => {
    res.json(recordingController.getStatus());
  });

  return router;
};
