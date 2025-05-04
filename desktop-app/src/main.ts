import { app, BrowserWindow, Menu, desktopCapturer, session } from "electron";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

process.env.API_BASE_URL = "http://localhost:3033";

let mainWindow: BrowserWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Use path.join for cross-platform compatibility
      contextIsolation: true, // Protect against prototype pollution
      nodeIntegration: false, // Recommended security practice
    },
  });

  // Load the index.html of the app.
  // We'll copy the public/index.html here later
  mainWindow.loadFile(path.join(__dirname, "../src/index.html")); // Adjust path to load from src

  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Create application menu with audio test option
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Exit",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Audio Recording Test",
          click: () => {
            mainWindow.loadFile(path.join(__dirname, "../src/audio-test.html"));
          },
        },
        {
          label: "Minimal Audio Test",
          click: () => {
            mainWindow.loadFile(
              path.join(__dirname, "../src/minimal-audio-test.html")
            );
          },
        },
        {
          label: "Main Application",
          click: () => {
            mainWindow.loadFile(path.join(__dirname, "../src/index.html"));
          },
        },
        {
          label: "Fixed Application",
          click: () => {
            mainWindow.loadFile(
              path.join(__dirname, "../src/fixed-index.html")
            );
          },
        },
      ],
    },
    {
      label: "Developer",
      submenu: [
        {
          label: "Toggle DevTools",
          accelerator:
            process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.reload();
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set up the display media request handler for system audio capture
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    console.log("Display media request received");

    // Get screen sources
    desktopCapturer
      .getSources({ types: ["screen"] })
      .then((sources) => {
        if (sources.length > 0) {
          console.log(
            `Found ${sources.length} screen sources, using first source`
          );
          // Use the first source and specify 'loopback' for system audio
          callback({ video: sources[0], audio: "loopback" });
        } else {
          console.error("No screen sources found");
          // Return an empty object instead of null to avoid TypeScript error
          callback({});
        }
      })
      .catch((err) => {
        console.error("Error getting screen sources:", err);
        // Return an empty object instead of null to avoid TypeScript error
        callback({});
      });
  });

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
