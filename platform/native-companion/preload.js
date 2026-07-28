const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lumicapNative", {
  getSources: () => ipcRenderer.invoke("lumicap:sources"),
  savePng: (payload) => ipcRenderer.invoke("lumicap:save-png", payload),
  saveRecording: (payload) => ipcRenderer.invoke("lumicap:save-recording", payload),
  openStudio: () => ipcRenderer.invoke("lumicap:open-studio"),
  showFile: (filePath) => ipcRenderer.invoke("lumicap:show-file", filePath),
  onShortcut: (callback) => ipcRenderer.on("lumicap:shortcut", (_event, action) => callback(action)),
  onShortcutStatus: (callback) => ipcRenderer.on("lumicap:shortcut-status", (_event, status) => callback(status))
});
