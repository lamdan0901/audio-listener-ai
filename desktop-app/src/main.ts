import {
  app,
  BrowserWindow,
  Menu,
  desktopCapturer,
  session,
  ipcMain,
} from "electron";
import * as path from "path";
import * as dotenv from "dotenv";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = app.isPackaged ? "production" : "development";
}

// Load environment variables from .env file
// IF .env IS COPIED TO THE SAME DIRECTORY AS main.js (e.g., dist/)
const envPath = path.join(
  __dirname,
  process.env.NODE_ENV === "production" ? ".env.production" : ".env"
);

// dotenv can often read from within ASAR if the path is correct relative to ASAR structure.
// We skip fs.existsSync because it's unreliable for ASAR paths.
try {
  const result = dotenv.config({
    path: envPath,
  });
  if (result.error) {
    console.warn("dotenv.config error:", result.error);
  }
  if (!process.env.API_BASE_URL) {
    console.warn(
      ".env file might have been found by path, but API_BASE_URL was not loaded from it or is empty."
    );
  }
} catch (e) {
  console.error("Error during dotenv.config:", e);
}

console.log("Main process NODE_ENV:", process.env.NODE_ENV);

let mainWindow: BrowserWindow;
let isAlwaysOnTop = false;

function createWindow() {
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

  if (process.env.NODE_ENV === "development") {
    const menu = Menu.buildFromTemplate([
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

  // Set up IPC handler for toggling always on top
  ipcMain.handle("toggle-always-on-top", () => {
    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    return isAlwaysOnTop;
  });

  // Set up IPC handler for getting the current always on top state
  ipcMain.handle("get-always-on-top-state", () => {
    return isAlwaysOnTop;
  });

  // Set up IPC handler for getting the NODE_ENV
  ipcMain.handle("get-node-env", () => {
    return process.env.NODE_ENV || "development";
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
