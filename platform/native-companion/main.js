const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const bundledFfmpegPath = require("ffmpeg-static");

const STUDIO_URL = "https://lumicap-chatgpt-app.minopro.workers.dev/studio/?source=native-companion";
let mainWindow;
let tray;
let isQuitting = false;

const instanceLock = app.requestSingleInstanceLock();
if (!instanceLock) app.quit();

function ffmpegExecutable() {
  return bundledFfmpegPath.replace("app.asar", "app.asar.unpacked");
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function commandFromUrl(url) {
  if (typeof url !== "string" || !url.startsWith("lumicap://")) return null;
  const command = url.slice("lumicap://".length).split(/[/?#]/)[0];
  return ["capture", "record", "studio"].includes(command) ? command : null;
}

function handleDeepLink(url) {
  const action = commandFromUrl(url);
  if (!action) return;
  if (action === "studio") {
    void shell.openExternal(STUDIO_URL);
    return;
  }
  showWindow();
  emitShortcut(action);
}

function deepLinkFromArgs(args) {
  return args.find((value) => typeof value === "string" && value.startsWith("lumicap://"));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 880,
    minHeight: 650,
    backgroundColor: "#09111f",
    title: "LUMICAP Native Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile("index.html");
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function emitShortcut(action) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("lumicap:shortcut", action);
}

function registerShortcuts() {
  const results = {
    printScreen: globalShortcut.register("PrintScreen", () => emitShortcut("capture")),
    capture: globalShortcut.register("CommandOrControl+Shift+1", () => emitShortcut("capture")),
    record: globalShortcut.register("CommandOrControl+Shift+2", () => emitShortcut("record")),
    studio: globalShortcut.register("CommandOrControl+Shift+3", () => shell.openExternal(STUDIO_URL))
  };
  mainWindow?.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("lumicap:shortcut-status", results);
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 24, height: 24 });
  tray = new Tray(icon);
  tray.setToolTip("LUMICAP — PrintScreenでキャプチャ");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "LUMICAPを開く", click: showWindow },
    { label: "静止画を取得", accelerator: "CommandOrControl+Shift+1", click: () => emitShortcut("capture") },
    { label: "録画を開始・停止", accelerator: "CommandOrControl+Shift+2", click: () => emitShortcut("record") },
    { type: "separator" },
    { label: "Studioを開く", click: () => void shell.openExternal(STUDIO_URL) },
    {
      label: "終了",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("double-click", showWindow);
}

app.setAsDefaultProtocolClient("lumicap");

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
  const initialLink = deepLinkFromArgs(process.argv);
  if (initialLink) handleDeepLink(initialLink);
  app.on("activate", () => {
    showWindow();
  });
});

app.on("second-instance", (_event, argv) => {
  const url = deepLinkFromArgs(argv);
  if (url) handleDeepLink(url);
  else showWindow();
});
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("will-quit", () => globalShortcut.unregisterAll());

ipcMain.handle("lumicap:sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 1920, height: 1080 },
    fetchWindowIcons: true
  });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    displayId: source.display_id,
    thumbnail: source.thumbnail.toDataURL(),
    icon: source.appIcon?.toDataURL() || null
  }));
});

ipcMain.handle("lumicap:save-png", async (_event, { dataUrl, suggestedName }) => {
  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/png;base64,") ||
    dataUrl.length > 140_000_000
  ) {
    throw new Error("PNGデータが無効または大きすぎます");
  }
  const safeName =
    typeof suggestedName === "string" && /^[\p{L}\p{N}_. -]{1,120}$/u.test(suggestedName)
      ? suggestedName
      : `LUMICAP-${Date.now()}.png`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "LUMICAP PNGを保存",
    defaultPath: path.join(app.getPath("pictures"), safeName),
    filters: [{ name: "PNG画像", extensions: ["png"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const bytes = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  await fs.writeFile(result.filePath, bytes);
  return { canceled: false, filePath: result.filePath };
});

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegExecutable(), [
      "-y",
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath
    ], { windowsHide: true });
    let details = "";
    child.stderr.on("data", (chunk) => {
      details = `${details}${chunk}`.slice(-4000);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`MP4変換に失敗しました (${code})\n${details}`));
    });
  });
}

ipcMain.handle("lumicap:save-recording", async (_event, { bytes, format, suggestedName }) => {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 2_000_000_000) {
    throw new Error("録画データが無効または大きすぎます");
  }
  const extension = format === "mp4" ? "mp4" : "webm";
  const safeName =
    typeof suggestedName === "string" && /^[\p{L}\p{N}_. -]{1,120}$/u.test(suggestedName)
      ? suggestedName
      : `LUMICAP-recording-${Date.now()}`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "LUMICAP録画を保存",
    defaultPath: path.join(app.getPath("videos"), `${safeName}.${extension}`),
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const source = Buffer.from(bytes);
  if (format === "webm") {
    await fs.writeFile(result.filePath, source);
    return { canceled: false, filePath: result.filePath };
  }

  const temporaryPath = path.join(app.getPath("temp"), `lumicap-${Date.now()}.webm`);
  try {
    await fs.writeFile(temporaryPath, source);
    await runFfmpeg(temporaryPath, result.filePath);
    return { canceled: false, filePath: result.filePath };
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
});

ipcMain.handle("lumicap:open-studio", () => shell.openExternal(STUDIO_URL));
ipcMain.handle("lumicap:show-file", (_event, filePath) => {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return;
  shell.showItemInFolder(filePath);
});
