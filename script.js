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

// Google clients
const speechClient = new speech.SpeechClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let ffmpegProcess = null;
let isRecording = false;
let currentOutputFile = null;

app.use(express.static('public'));
app.use(express.json());

app.post('/start', (req, res) => {
  if (isRecording) return res.status(400).send('Already recording');
  // we could store req.body.language here if needed per-session
  currentOutputFile = `audio/${Date.now()}.wav`;
  const ffmpegArgs = getFfmpegArgs(currentOutputFile);
  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  ffmpegProcess.stderr.on('data', d => console.error(`FFmpeg Error: ${d}`));
  ffmpegProcess.on('close', code => {
    isRecording = false;
    if (code !== 0 && code !== null) {
      console.error(`FFmpeg exited with code ${code}`);
      if (currentOutputFile && fs.existsSync(currentOutputFile)) fs.unlinkSync(currentOutputFile);
    }
    currentOutputFile = null;
  });
  process.on('exit', () => {
    if (currentOutputFile && fs.existsSync(currentOutputFile)) fs.unlinkSync(currentOutputFile);
  });
  isRecording = true;
  res.status(200).send('Recording started');
});

app.post('/stop', async (req, res) => {
  if (!isRecording) return res.status(400).send('Not recording');
  // read the language flag from the front‑end
  const lang = req.body.language === 'en' ? 'en' : 'vi';
  ffmpegProcess.kill('SIGINT');
  isRecording = false;

  try {
    // wait for file to be ready...
    await waitForFile(currentOutputFile);
    io.emit('processing');

    // choose correct speech‐to‐text language code
    const languageCode = lang === 'vi' ? 'vi-VN' : 'en-US';
    const transcript = await transcribeAudio(currentOutputFile, languageCode);
	
	if (!transcript) {
      const apology = languageCode.startsWith('vi')
        ? 'Xin lỗi, tôi không nghe rõ. Vui lòng thử lại.'
        : 'Sorry, I didn’t catch that. Please try again.';
      
      io.emit('update', {
        transcript: '',
        answer: apology
      });
      return res.status(200).send('No speech detected');
    }

    // generate with a small prompt‐prefix if Vietnamese
    const answer = await generateAnswer(transcript, lang);
    io.emit('update', { transcript, answer });
  } catch (err) {
    console.error('Processing error:', err);
    io.emit('error', err.message);
  } finally {
    if (currentOutputFile && fs.existsSync(currentOutputFile)) fs.unlinkSync(currentOutputFile);
    currentOutputFile = null;
  }

  res.status(200).send('Recording stopped');
});

// Helpers

function getFfmpegArgs(outputFile) {
  const args = ['-y','-hide_banner','-loglevel','error'];
  if (process.platform === 'win32') {
    args.push('-f','dshow','-i','audio=virtual-audio-capturer');
  } else if (process.platform === 'linux') {
    args.push('-f','pulse','-i','YOUR_MONITOR_SOURCE_NAME');
  } else {
    throw new Error('Unsupported platform');
  }
  args.push('-ac','1','-ar','16000','-acodec','pcm_s16le', outputFile);
  return args;
}

async function waitForFile(filePath, retries = 10) {
  if (retries === 0) throw new Error('Audio file not found in time');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) {
    await new Promise(r => setTimeout(r, 200));
    return waitForFile(filePath, retries - 1);
  }
  return true;
}

async function transcribeAudio(filePath, languageCode) {
  const audioBytes = fs.readFileSync(filePath).toString('base64');
  const [response] = await speechClient.recognize({
    audio: { content: audioBytes },
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
	  enableAutomaticPunctuation: true,
      languageCode
    }
  });
  if (!response.results?.length) throw new Error('No transcription results');
  return response.results[0].alternatives[0].transcript;
}

async function generateAnswer(question, lang) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  let prompt;
  if (lang === 'vi') {
    prompt = `Question will be in Vietnamese and answer must be in Vietnamese. ` +
             `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
             `Use headings, lists, and code blocks where appropriate.`;
  } else {
    prompt = `Answer the following question concisely using Markdown formatting for better readability: ${question}. ` +
             `Use headings, lists, and code blocks where appropriate.`;
  }
  const result = await model.generateContent(prompt);
  return result.response.text();
}

io.on('connection', socket => console.log('Client connected'));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!fs.existsSync('audio')) fs.mkdirSync('audio', { recursive: true });
});
