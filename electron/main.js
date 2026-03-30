const { app, BrowserWindow } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const net = require("net");

const PORT = 50911;
const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const socket = new net.Socket();
      socket.setTimeout(200);
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error("Server start timeout"));
        } else {
          setTimeout(check, 200);
        }
      });
      socket.on("timeout", () => {
        socket.destroy();
        setTimeout(check, 200);
      });
      socket.connect(port, "127.0.0.1");
    };
    check();
  });
}

function startServer() {
  if (isDev) {
    // В dev-режиме предполагаем, что `npm run dev` запущен отдельно
    return waitForPort(PORT);
  }

  // Production: запуск standalone Next.js сервера
  const standalonePath = path.join(process.resourcesPath, "standalone");
  const serverPath = path.join(standalonePath, "server.js");

  const userDataPath = app.getPath("userData");

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: PORT.toString(),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DATA_DIR: path.join(userDataPath, "data"),
    },
    cwd: standalonePath,
  });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });

  return waitForPort(PORT);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", async () => {
  try {
    await startServer();
    createWindow();
  } catch (e) {
    console.error("Failed to start:", e);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
