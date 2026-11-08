import { contextBridge, ipcRenderer } from 'electron';
import { IPC, EVENTS } from '../shared/protocol.js';

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (filename, data) => ipcRenderer.invoke(IPC.saveFile, filename, data),
    listFiles: () => ipcRenderer.invoke(IPC.listFiles),
    getFile: (filename) => ipcRenderer.invoke(IPC.getFile, filename),
    deleteFile: (filename) => ipcRenderer.invoke(IPC.deleteFile, filename),
    exportData: () => ipcRenderer.invoke(IPC.exportData),
    importData: () => ipcRenderer.invoke(IPC.importData),
    openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
    setWatcherEnabled: (enabled) => ipcRenderer.send(IPC.setWatcherEnabled, enabled),
    on: (channel, callback) => {
        if (!EVENTS.has(channel)) {
            throw new Error(`The renderer cannot listen to "${channel}"`);
        }
        const listener = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
});
