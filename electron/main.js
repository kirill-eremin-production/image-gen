const { app, BrowserWindow, ipcMain, systemPreferences } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const PORT = 50911;
const isDev = !app.isPackaged;
const DEV_ICON_PATH = path.join(__dirname, "../assets/icon.png");

let mainWindow;
let serverProcess;

function migrateLegacyData() {
  if (isDev) return;

  const legacyDataPath = path.join(
    app.getPath("appData"),
    "Image Generator",
    "data",
  );
  const currentDataPath = path.join(app.getPath("userData"), "data");

  if (fs.existsSync(legacyDataPath) && !fs.existsSync(currentDataPath)) {
    fs.mkdirSync(path.dirname(currentDataPath), { recursive: true });
    fs.cpSync(legacyDataPath, currentDataPath, { recursive: true });
  }
}

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
    title: "Narisuy",
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("prompt-touch-id", async (_event, reason) => {
  if (process.platform !== "darwin") {
    return { ok: false, error: "Touch ID недоступен на этой платформе" };
  }

  if (!systemPreferences.canPromptTouchID()) {
    return { ok: false, error: "Touch ID недоступен на этом устройстве" };
  }

  try {
    await systemPreferences.promptTouchID(reason || "Подтвердите доступ");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Проверка биометрии не пройдена",
    };
  }
});

app.on("ready", async () => {
  try {
    if (isDev && process.platform === "darwin" && app.dock) {
      app.dock.setIcon(DEV_ICON_PATH);
    }
    migrateLegacyData();
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
