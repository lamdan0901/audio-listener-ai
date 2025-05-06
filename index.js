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
    allowedHeaders: ["Content-Type", "Authorization", "User-Agent"],
    credentials: true,
  },
  // Socket.IO server configuration for better mobile compatibility
  pingTimeout: 10000, // Shorter ping timeout (10 seconds)
  pingInterval: 5000, // More frequent pings (5 seconds)
  connectTimeout: 10000, // Shorter connection timeout (10 seconds)
  maxHttpBufferSize: 5e6, // 5MB max buffer size for messages
  transports: ["polling", "websocket"], // Support both polling and websocket, but prefer polling for mobile
  allowUpgrades: true, // Allow transport upgrades
  perMessageDeflate: {
    threshold: 1024, // Only compress messages larger than 1KB
  },
});
const PORT = process.env.PORT || 3000;

// Set up middleware for parsing request bodies
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
const statusRoutes = require("./routes/statusRoutes")();

// Set up API routes with proper versioning
app.use("/api/v1/recording", recordingRoutes);
app.use("/api/v1/status", statusRoutes);

// Root route for health check
app.get("/", (req, res, next) => {
  // Check if the request accepts JSON
  const acceptsJson = req.accepts("json");

  if (acceptsJson) {
    // Return JSON for API clients
    res.json({
      status: "ok",
      message: "Audio processing API is running",
      version: "1.0.0",
      endpoints: {
        status: "/api/v1/status",
        recording: "/api/v1/recording",
      },
    });
  } else {
    // For browser requests, continue to the next middleware (static file serving)
    next();
  }
});

// Add a catch-all route for API requests
app.use("/api", (req, res) => {
  return res.status(404).json({
    status: "error",
    message: "API endpoint not found",
    path: req.path,
  });
});

// Serve static files AFTER API routes
app.use(express.static("public"));

// Catch-all route for non-API requests that don't match static files
app.use((req, res) => {
  // For any other routes, serve the index.html file
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  const clientInfo = {
    id: socket.id,
    transport: socket.conn.transport.name,
    address: socket.handshake.address,
    userAgent: socket.handshake.headers["user-agent"] || "Unknown",
    query: socket.handshake.query || {},
  };

  console.log("Client connected:", clientInfo);

  // Send immediate acknowledgment to the client
  socket.emit("connected", {
    id: socket.id,
    serverTime: new Date().toISOString(),
    message: "Connection established successfully",
  });

  // Handle client disconnect
  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected (${socket.id}): ${reason}`);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`Socket error for client ${socket.id}:`, error);
  });

  // Handle ping timeout
  socket.conn.on("ping timeout", () => {
    console.warn(`Ping timeout for client ${socket.id}`);
  });
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
