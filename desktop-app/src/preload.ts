import { contextBridge, ipcRenderer } from "electron";

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// Expose the API base URL loaded in the main process to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  getApiBaseUrl: () => process.env.API_BASE_URL,

  // Add a method to check if system audio capture is supported
  isSystemAudioCaptureSupported: () => {
    // In Electron with our display media handler, system audio capture is supported
    return true;
  },

  getElectronVersion: () => process.versions.electron,

  toggleAlwaysOnTop: async () => {
    return await ipcRenderer.invoke("toggle-always-on-top");
  },

  getAlwaysOnTopState: async () => {
    return await ipcRenderer.invoke("get-always-on-top-state");
  },

  // Use IPC to get NODE_ENV from main process
  isDevelopment: async () => {
    const nodeEnv = await ipcRenderer.invoke("get-node-env");
    console.log("NODE_ENV", nodeEnv);
    return nodeEnv !== "production";
  },
});

// No need to expose additional APIs for audio recording as it's handled in the renderer process
// The MediaRecorder API is available in the renderer process by default

console.log("Preload script loaded and API URL exposed.");
