const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Запускаем сервер
  serverProcess = fork(path.join(__dirname, "server.js"));

  // Ждем немного, чтобы сервер успел подняться, и загружаем страницу
  setTimeout(() => {
    mainWindow.loadURL("http://localhost:3000");
  }, 1000);

  mainWindow.on("closed", function () {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
  if (serverProcess) serverProcess.kill();
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});
