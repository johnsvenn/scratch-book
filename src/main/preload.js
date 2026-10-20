import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (filename, data) => ipcRenderer.invoke('save-file', filename, data),
    listFiles: () => ipcRenderer.invoke('list-files'),
    getFile: (filename) => ipcRenderer.invoke('get-file', filename),
    deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename),
    exportData: () => ipcRenderer.invoke('export-data'),
    importData: () => ipcRenderer.invoke('import-data'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    setWatcherEnabled: (enabled) => ipcRenderer.send('set-watcher-enabled', enabled),
    on: (channel, callback) => {
        const listener = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
    once: (channel, callback) => {
        ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    },
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },
});
