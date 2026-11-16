const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  openBackupFolder: (targetId = 'primary') =>
    ipcRenderer.invoke('app:open-backup-folder', targetId),
  getBackupStatus: () => ipcRenderer.invoke('app:backup-status'),
  createBackup: () => ipcRenderer.invoke('app:create-backup'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
})
