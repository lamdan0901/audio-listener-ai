import { contextBridge } from "electron";

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// Expose the API base URL loaded in the main process to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  getApiBaseUrl: () => process.env.API_BASE_URL,
});

// No need to expose additional APIs for audio recording as it's handled in the renderer process
// The MediaRecorder API is available in the renderer process by default

console.log("Preload script loaded and API URL exposed.");
