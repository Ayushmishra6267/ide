const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (p) => ipcRenderer.invoke('fs:readDir', p),
  readFile: (p) => ipcRenderer.invoke('fs:readFile', p),
  writeFile: (p, t) => ipcRenderer.invoke('fs:writeFile', p, t),
  createFile: (p) => ipcRenderer.invoke('fs:createFile', p),
  createDir: (p) => ipcRenderer.invoke('fs:createDir', p),
  rename: (a, b) => ipcRenderer.invoke('fs:rename', a, b),
  duplicate: (p) => ipcRenderer.invoke('fs:duplicate', p),
  trash: (p) => ipcRenderer.invoke('fs:trash', p),
  reveal: (p) => ipcRenderer.invoke('fs:reveal', p),
  termCreate: (cwd, cols, rows) => ipcRenderer.invoke('term:create', cwd, cols, rows),
  termWrite: (id, d) => ipcRenderer.send('term:write', id, d),
  termResize: (id, c, r) => ipcRenderer.send('term:resize', id, c, r),
  termKill: (id) => ipcRenderer.send('term:kill', id),
  extList: () => ipcRenderer.invoke('ext:list'),
  extDetect: () => ipcRenderer.invoke('ext:detect'),
  extOpenFolder: () => ipcRenderer.invoke('ext:openFolder'),
  extOpenUrl: (u) => ipcRenderer.invoke('ext:openUrl', u),
  onTermData: (cb) => {
    const h = (_e, id, d) => cb(id, d);
    ipcRenderer.on('term:data', h);
    return () => ipcRenderer.removeListener('term:data', h);
  }
});
