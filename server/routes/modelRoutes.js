const express = require("express");
const router = express.Router();
const modelController = require("../controllers/modelController");

module.exports = () => {
  // GET /api/v1/models - List available models
  router.get("/", modelController.listModels);

  return router;
};
