const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
})
