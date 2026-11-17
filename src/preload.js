const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdr', {
  state: () => ipcRenderer.invoke('state'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  sync: () => ipcRenderer.invoke('sync'),
  send: (key) => ipcRenderer.invoke('send', key),
  ignore: (key) => ipcRenderer.invoke('ignore', key),
  pause: (v) => ipcRenderer.invoke('pause', v),
  saveConfig: (c) => ipcRenderer.invoke('save-config', c),
  chooseCredentials: () => ipcRenderer.invoke('choose-credentials'),
  copyScript: () => ipcRenderer.invoke('copy-script'),
  logout:() => ipcRenderer.invoke('logout'),
  openSheet: () => ipcRenderer.invoke('open-sheet'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
});
