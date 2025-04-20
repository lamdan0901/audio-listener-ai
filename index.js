require("dotenv").config();
const express = require("express");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");

const {
  checkFFmpegAvailability,
  cleanupAudioFiles,
} = require("./utils/ffmpeg");

const app = express();
const server = require("http").createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

const recordingRoutes = require("./routes/recordingRoutes")(io);

app.use("/", recordingRoutes);

io.on("connection", (socket) => console.log("Client connected"));

process.on("exit", () => {
  console.log("Application exiting, cleaning up resources");

  // Delete any temporary audio files
  const audioDir = path.join(__dirname, "audio");
  cleanupAudioFiles(audioDir);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!fs.existsSync("audio")) fs.mkdirSync("audio", { recursive: true });

  checkFFmpegAvailability();
});
