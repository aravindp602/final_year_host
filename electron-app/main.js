const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = !app.isPackaged; // true if running `npm start`

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    // Development → load React dev server
    win.loadURL("http://localhost:3001");

    // Open DevTools automatically for debugging
    //win.webContents.openDevTools();
  } else {
    // Production → load the React build
    win.loadFile(path.join(__dirname, "build", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
