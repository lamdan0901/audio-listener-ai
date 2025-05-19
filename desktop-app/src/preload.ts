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

  // Add a method to get the Electron version
  getElectronVersion: () => process.versions.electron,

  // Add methods for always on top functionality
  toggleAlwaysOnTop: async () => {
    return await ipcRenderer.invoke("toggle-always-on-top");
  },

  getAlwaysOnTopState: async () => {
    return await ipcRenderer.invoke("get-always-on-top-state");
  },

  // Add a method to check if we're in development mode
  isDevelopment: () => {
    // process.env.NODE_ENV is set by Electron Forge during build
    // It will be 'production' in production builds and 'development' in dev mode
    return process.env.NODE_ENV !== "production";
  },
});

// No need to expose additional APIs for audio recording as it's handled in the renderer process
// The MediaRecorder API is available in the renderer process by default

console.log("Preload script loaded and API URL exposed.");
