// server.js
require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const speech = require('@google-cloud/speech');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = require('http').createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Configure Google services
const speechClient = new speech.SpeechClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let ffmpegProcess = null;
let isRecording = false;

app.use(express.static('public'));
app.use(express.json());

// Routes
let currentOutputFile = null;

app.post('/start', (req, res) => {
  if (isRecording) return res.status(400).send('Already recording');
  
  currentOutputFile = `audio/${Date.now()}.wav`;
  const ffmpegArgs = getFfmpegArgs(currentOutputFile);
  
  // Add error listeners
  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`FFmpeg Error: ${data}`);
  });


// Update FFmpeg process handling
ffmpegProcess.on('close', (code) => {
  isRecording = false;
  if (code !== 0 && code !== null) {
    console.error(`FFmpeg exited with code ${code}`);
    // Cleanup if file was partially created
    if (currentOutputFile && fs.existsSync(currentOutputFile)) {
      fs.unlinkSync(currentOutputFile);
    }
  }
  currentOutputFile = null;
});

// Add process exit handler
process.on('exit', () => {
  if (currentOutputFile && fs.existsSync(currentOutputFile)) {
    fs.unlinkSync(currentOutputFile);
  }
});

  isRecording = true;
  res.status(200).send('Recording started');
});

app.post('/stop', async (req, res) => {
  if (!isRecording) return res.status(400).send('Not recording');

  ffmpegProcess.kill('SIGINT');
  isRecording = false;

  const checkFile = async (retries = 10) => {
    if (retries === 0) {
      throw new Error('File not found after 2 seconds');
    }
    
    if (!fs.existsSync(currentOutputFile)) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return checkFile(retries - 1);
    }
    
    const stats = fs.statSync(currentOutputFile);
    if (stats.size < 1024) {
      throw new Error('Empty audio file');
    }
    return true;
  };

  try {
    const fileExists = await checkFile();
    if (fileExists) {
      io.emit('processing');
      const transcript = await transcribeAudio(currentOutputFile);
      const answer = await generateAnswer(transcript);
      io.emit('update', { transcript, answer });
    }
  } catch (error) {
    console.error('Processing error:', error);
    io.emit('error', error.message);
  } finally {
    // Safe file cleanup
    if (currentOutputFile && fs.existsSync(currentOutputFile)) {
      fs.unlinkSync(currentOutputFile);
    }
    currentOutputFile = null;
  }
  
  res.status(200).send('Recording stopped');
});

// Helper functions
function getFfmpegArgs(outputFile) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];

  if (process.platform === 'win32') {
  args.push('-f','dshow','-i','audio=virtual-audio-capturer')
  } else if (process.platform === 'linux') {
    // see Linux section below
    args.push(
      '-f', 'pulse',
      '-i', 'YOUR_MONITOR_SOURCE_NAME'
    );
  } else {
    throw new Error('Unsupported platform');
  }

  // common encoding settings
  args.push(
    '-ac', '1',
    '-ar', '16000',
    '-acodec', 'pcm_s16le',
    outputFile
  );
  return args;
}

async function transcribeAudio(filePath) {
  try {
    const audioBytes = fs.readFileSync(filePath);
    if (audioBytes.length < 1024) {
      throw new Error('Audio file too small');
    }

    const audio = {
      content: audioBytes.toString('base64'),
    };
    
    const [response] = await speechClient.recognize({
      audio: audio,
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
      },
    });

    if (!response.results || response.results.length === 0) {
      throw new Error('No transcription results');
    }

    return response.results[0].alternatives[0].transcript;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

async function generateAnswer(question) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  const prompt = `Answer the following question concisely using Markdown formatting for better readability: ${question}.
    Use headings, lists, and code blocks where appropriate. Also, the questions are often in frontend development with html, css, javascript, typescript, reactjs, next.js and related tech`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// WebSocket setup
io.on('connection', (socket) => {
  console.log('Client connected');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!fs.existsSync('audio')) {
    fs.mkdirSync('audio', { recursive: true });
  }
});