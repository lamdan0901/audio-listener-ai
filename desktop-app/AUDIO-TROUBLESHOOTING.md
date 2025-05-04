# Audio Recording Troubleshooting Guide

This guide provides several tools and methods to diagnose and fix audio recording issues in the desktop application.

## Browser-Based Tests

### 1. Minimal Audio Test

This is the simplest test to check if basic audio recording works in the Electron environment.

**How to use:**
1. Start the desktop app
2. Go to `Tools` > `Minimal Audio Test` in the menu
3. Follow the numbered steps on the page:
   - Click "1. Request Microphone Permission"
   - Click "2. Start Recording" and speak into your microphone
   - Click "3. Stop Recording"
   - Click "4. Play Recording" to hear what was recorded
4. Check the log for any error messages

### 2. Advanced Audio Test

A more comprehensive test with additional options for audio formats.

**How to use:**
1. Start the desktop app
2. Go to `Tools` > `Audio Recording Test` in the menu
3. Select an audio format from the dropdown
4. Click "Start Recording" and speak into your microphone
5. Click "Stop Recording"
6. Click "Play Recording" to hear what was recorded
7. Check the log for any error messages

### 3. In-App Diagnostic Tools

The main application includes diagnostic tools at the bottom of the page.

**How to use:**
1. Start the desktop app
2. Scroll to the bottom of the main page
3. Click "Check Audio System" to see information about your audio system
4. Use the test recording buttons to test audio recording directly

## Command-Line Tests

These tests run directly from the command line and bypass the browser/Electron environment completely.

### 1. Check Audio Devices

Lists all audio input and output devices on your system.

**How to use:**
```
cd desktop-app
node check-audio-devices.js
```

### 2. Native Audio Recording Test

Tests audio recording using ffmpeg, which directly accesses system audio devices.

**Prerequisites:**
- Install ffmpeg and make sure it's in your PATH

**How to use:**
```
cd desktop-app
node native-audio-test.js
```

## Common Issues and Solutions

### 1. No Audio Devices Detected

**Symptoms:**
- "No audio devices found" error
- Permission denied errors

**Solutions:**
- Check if your microphone is properly connected
- Check if your microphone is enabled in Windows settings
- Make sure your microphone is not being used by another application
- Try restarting your computer

### 2. Recording Works in Tests But Not in the App

**Symptoms:**
- Test recordings work fine
- App recordings are empty or corrupted

**Solutions:**
- Check the browser console for errors
- Try using a different MIME type in the app
- Check if the app has the correct permissions

### 3. Empty or Corrupted Recordings

**Symptoms:**
- Recording file is very small (less than 1KB)
- Recording plays back as silence or noise

**Solutions:**
- Try a different audio format
- Check if your microphone is working in other applications
- Try a different microphone if available

## Reporting Issues

When reporting issues, please include:
1. Which tests you've tried and their results
2. Any error messages from the console
3. Your operating system and version
4. Your microphone model/type
