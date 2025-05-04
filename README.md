# Audio Listener AI

A simple AI application that listens to audio and answers questions using speech-to-text and AI processing.

## System Design Documentation

This repository includes comprehensive system design documentation:

- **[AudioListenerAI_SoftwareDesign.md](AudioListenerAI_SoftwareDesign.md)**: The main software design document that provides a detailed analysis of the system architecture, components, data flow, and design patterns.

- **[diagrams/](diagrams/)**: A folder containing various diagrams that illustrate the architecture, components, and behavior of the system, including class diagrams, sequence diagrams, component diagrams, and more.

## Features

- Record audio from your microphone
- Convert speech to text using AssemblyAI
- Process questions with Google's Gemini AI
- Support for multiple languages (English, Vietnamese)
- History tracking for previous questions and answers
- Retry transcription with different models
- Direct processing with Gemini AI

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your API keys (see `.env.example`)
4. Start the application:
   ```
   npm start
   ```

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **Speech-to-Text**: AssemblyAI
- **AI Processing**: Google Gemini AI
- **Audio Processing**: FFmpeg
- **Real-time Communication**: Socket.IO

## How It Works

1. The application records audio from your microphone using FFmpeg
2. The audio is sent to AssemblyAI for transcription
3. The transcribed text is processed by Google's Gemini AI
4. The response is streamed back to the client in real-time

## License

MIT
