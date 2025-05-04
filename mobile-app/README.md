# Audio Listener AI - Mobile App (React Native / Expo)

This is a mobile application built with React Native and Expo (TypeScript template) that replicates the functionality of the Audio Listener AI web application.

It allows users to record audio questions, select language and context, send the audio for transcription and AI processing via a backend server, and view the results, including a history of previous interactions.

## Features

- Audio Recording using device microphone.
- Language Selection (English/Vietnamese).
- Question Context Selection (General, Frontend topics, etc.).
- Custom Context Input for AI instructions.
- Real-time updates via WebSockets for transcription and AI answers.
- Streaming AI answer display with Markdown rendering.
- Option to retry transcription or process with Gemini AI.
- Cancel ongoing requests.
- Follow-up question support.
- History of questions and answers stored locally.
- Clear history functionality.

## Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Expo Go app installed on your physical Android/iOS device OR an Android Emulator / iOS Simulator setup.
- The backend server for the Audio Listener AI project must be running.

## Setup

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the backend directory** (`../` relative to this folder) and start the server (e.g., `npm start` or `node index.js`). Note the IP address and port the server is running on.
3.  **Configure Backend URL:**
    - Create a file named `.env` in the `mobile-app` directory (this file is ignored by git).
    - Add the following line to the `.env` file, replacing the URL with the actual local IP address and port of your running backend server:
      ```
      API_URL=http://YOUR_LOCAL_IP:3033
      ```
    - **Important:** If running the app on a physical device or separate emulator, you **must** use your computer's local network IP address (e.g., `http://192.168.1.15:3033`), not `localhost`. The default in the `.env` file created by the setup is `http://localhost:3033`, which will only work if the backend and the app (e.g., web version or simulator on the same machine) are running on the exact same host.
4.  **Install Dependencies:** Navigate to this `mobile-app` directory in your terminal and run:
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```

## Running the App

Once the setup is complete and the backend server is running, you can start the mobile app using one of the following commands from the `mobile-app` directory:

- **On Android:**

  ```bash
  npm run android
  ```

  or

  ```bash
  npx expo start --android
  ```

  This will attempt to open the app on a connected Android device or emulator using the Expo Go app.

- **On iOS:**

  ```bash
  npm run ios
  ```

  or

  ```bash
  npx expo start --ios
  ```

  This will attempt to open the app on a connected iOS device (using Expo Go) or simulator. _Note: Building for iOS simulators/devices often requires macOS._

- **In Web Browser (for testing UI):**
  ```bash
  npm run web
  ```
  or
  ```bash
  npx expo start --web
  ```
  This opens the app in your web browser. Note that device-specific features like audio recording might behave differently or not work fully in the web version.

After running one of the start commands, Expo DevTools might open in your browser, and a QR code will likely appear in the terminal. You can scan this QR code using the Expo Go app on your device to load the application.
