# Audio Listener AI - JavaScript Modules

This directory contains the modular JavaScript files for the Audio Listener AI application.

## Module Structure

The codebase is split into these logical modules:

- **main.js**: The main entry point that initializes the application
- **animation.js**: Handles text animations and streaming content display
- **audio-controls.js**: Functions for controlling audio recording and processing
- **history-manager.js**: Manages the history functionality (saving, loading, displaying)
- **socket-handlers.js**: Handles all socket.io event listeners

## Loading Order

The modules must be loaded in the correct order due to dependencies:

1. animation.js
2. history-manager.js
3. audio-controls.js
4. socket-handlers.js
5. main.js

## Bridge File

For compatibility, `public/script.js` acts as a bridge file that loads all modules in the correct order.

## Global Variables

Some global variables are shared between modules:

- `socket`: The Socket.IO connection
- `isRecording`: Recording state flag
- `lastAudioFile`: Reference to the last processed audio file
- `isCancelled`: Flag for cancellation state
- `hasLastQuestion`: Flag indicating if we have a previous question
- `streamedContent`: Stores the accumulated streamed content
- `animationInProgress`: Flag for animation state
- `animationQueue`: Queue of pending animations
- `previousContent`: Stores previous content for animation comparisons
