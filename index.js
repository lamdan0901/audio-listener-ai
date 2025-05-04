require("dotenv").config();
const { setupConsoleTimestamps } = require("./utils/logger");
setupConsoleTimestamps();

const express = require("express");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const cors = require("cors"); // Import the cors package

const backendEvents = require("./lib/events");
const {
  checkFFmpegAvailability,
  cleanupAudioFiles,
} = require("./utils/ffmpeg");

const app = express();
const server = require("http").createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for Socket.IO connections
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" })); // Increase JSON payload limit for larger audio files
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Support form data with larger limit

// Configure CORS for all routes
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const recordingRoutes = require("./routes/recordingRoutes")();

// Set up API routes with proper versioning
app.use("/api/v1/recording", recordingRoutes);

// Root route for health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Audio processing API is running",
    version: "1.0.0",
  });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

// Bridge backend events to Socket.IO
backendEvents.on("error", (errorMessage) => {
  console.error("Broadcasting error via Socket.IO:", errorMessage);
  io.emit("error", errorMessage);
});

backendEvents.on("processingCancelled", (data) => {
  console.log("Broadcasting processingCancelled via Socket.IO:", data);
  io.emit("processingCancelled", data);
});
backendEvents.on("processing", () => {
  console.log("Broadcasting processing via Socket.IO");
  io.emit("processing");
});

backendEvents.on("transcript", (data) => {
  console.log("Broadcasting transcript via Socket.IO:", data);
  io.emit("transcript", data);
});

backendEvents.on("update", (data) => {
  console.log("Broadcasting update via Socket.IO:", data);
  io.emit("update", data);
});

backendEvents.on("streamChunk", (data) => {
  // Avoid excessive logging for chunks
  // console.log("Broadcasting streamChunk via Socket.IO:", data);
  io.emit("streamChunk", data);
});

backendEvents.on("streamEnd", (data) => {
  console.log("Broadcasting streamEnd via Socket.IO.");
  io.emit("streamEnd", data);
});

backendEvents.on("streamError", (data) => {
  console.error("Broadcasting streamError via Socket.IO:", data);
  io.emit("streamError", data);
});

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

  // Ensure audio directory exists for file uploads
  if (!fs.existsSync("audio")) {
    fs.mkdirSync("audio", { recursive: true });
    console.log("Created audio directory for file uploads");
  }

  // FFmpeg is still useful for potential audio format conversion
  // but no longer required for direct recording
  checkFFmpegAvailability()
    .then(() => console.log("FFmpeg is available for audio processing"))
    .catch((err) =>
      console.warn(
        "FFmpeg not available, some audio format conversions may fail:",
        err
      )
    );
});
