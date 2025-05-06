const express = require("express");
const router = express.Router();
const { baseController } = require("../controllers");

module.exports = () => {
  // Get the current status
  router.get("/", (req, res) => {
    try {
      // Use the same getStatus function from baseController
      const status = baseController.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting status:", error);
      res.status(500).json({
        success: false,
        error: `Error getting status: ${error.message}`,
      });
    }
  });

  return router;
};
