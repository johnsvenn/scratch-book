'use strict';

import { app, BrowserWindow, ipcMain, shell, dialog, Menu, MenuItem } from 'electron';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'path';
import Constants from '../renderer/lib/constants';
import chokidar from 'chokidar';
import AdmZip from 'adm-zip';
import { findBadPaths } from './zipPathValidator';
import { IPC, FILES, SETTINGS, readSettings, syncTokenPayload } from '../shared/protocol.js';

const fs = require('fs');
const fsp = fs.promises;

let mainWindow;

function createWindow() {
    createScratchDirectory();

    mainWindow = new BrowserWindow({
        height: 600,
        width: 1000,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, '../preload/index.js')
        },
    });

    // development / production URL loading logic for electron-vite
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('context-menu', async (event, params) => {
        // Only offer the edit menu inside the title, the content textarea, or the rendered markdown
        const inEditor = await mainWindow.webContents.executeJavaScript(
            `!!document.elementFromPoint(${params.x}, ${params.y})?.closest('.page-layout__title-input, .page-layout__content-textarea, .markdown-renderer')`
        );
        if (!inEditor) {
            return;
        }

        const menu = new Menu();

        // Add each spelling suggestion
        for (const suggestion of params.dictionarySuggestions) {
            menu.append(
                new MenuItem({
                    label: suggestion,
                    click: () => mainWindow.webContents.replaceMisspelling(suggestion)
                })
            );
        }

        // Allow users to add the misspelled word to the dictionary
        if (params.misspelledWord) {
            if (menu.items.length > 0) {
                menu.append(new MenuItem({ type: 'separator' }));
            }
            menu.append(
                new MenuItem({
                    label: 'Add to Dictionary',
                    click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
                })
            );
        }

        // Standard edit actions
        if (menu.items.length > 0) {
            menu.append(new MenuItem({ type: 'separator' }));
        }

        menu.append(new MenuItem({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut }));
        menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }));
        menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }));

        // Offer link insertion in the page content textarea
        // (inputFieldType is deprecated in Electron; formControlType replaces it)
        if (params.formControlType === 'text-area') {
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({
                label: 'Insert Link…',
                click: () => mainWindow.webContents.send(IPC.insertLink)
            }));
        }

        menu.popup();
    });
}

function getDirectoryPath() {
    let dataDirectory = Constants.DATA_DIRECTORY.DEFAULT;
    if (process.env.NODE_ENV === 'development') {
        dataDirectory = Constants.DATA_DIRECTORY.DEVELOPMENT;
    }
    return join(app.getPath('home'), dataDirectory);
}

// Resolves a renderer-supplied filename inside the data directory.
// Returns null if the result would fall outside it (e.g. '../secrets').
function resolveDataPath(filename) {
    const root = resolve(getDirectoryPath());
    const target = resolve(root, filename);
    const rel = relative(root, target);
    if (rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
        return null;
    }
    return target;
}

function createScratchDirectory() {
    const directoryPath = getDirectoryPath();
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle(IPC.saveFile, async (_, filename, data) => {
        if (!filename || typeof filename !== 'string') {
            return false;
        }
        const filePath = resolveDataPath(filename);
        if (!filePath) {
            return false;
        }
        try {
            // Create the directory if it doesn't exist
            await fsp.mkdir(dirname(filePath), { recursive: true });
            await fsp.writeFile(filePath, data);
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle(IPC.listFiles, async () => {
        try {
            // Return files and directories
            return await fsp.readdir(getDirectoryPath());
        } catch (e) {
            return [];
        }
    });

    ipcMain.handle(IPC.getFile, async (_, filename) => {
        if (!filename || typeof filename !== 'string') {
            return null;
        }
        const filePath = resolveDataPath(filename);
        if (!filePath) {
            return null;
        }
        try {
            return await fsp.readFile(filePath, 'utf8');
        } catch (e) {
            return null;
        }
    });

    ipcMain.handle(IPC.deleteFile, async (_, filename) => {
        if (!filename || typeof filename !== 'string') {
            return false;
        }
        const filePath = resolveDataPath(filename);
        if (!filePath) {
            return false;
        }
        try {
            // we use rmSync instead of unlinkSync so we can delete directories cleanly
            await fsp.rm(filePath, { recursive: true, force: true });
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle(IPC.exportData, async () => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export ScratchBook Data',
            defaultPath: join(app.getPath('downloads'), 'scratchbook-backup.zip'),
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });

        if (!filePath) {
            return false;
        }

        try {
            const zip = new AdmZip();
            const sourceDir = getDirectoryPath();

            // Add files one by one to filter out legacy data
            const files = await fsp.readdir(sourceDir);
            for (const file of files) {
                const fullPath = join(sourceDir, file);
                const stats = await fsp.stat(fullPath);

                if (stats.isDirectory()) {
                    zip.addLocalFolder(fullPath, file);
                } else {
                    // Filter out legacy files
                    if (file.endsWith('.txt') || file === 'index.json' || file === 'archive.json') {
                        continue;
                    }
                    zip.addLocalFile(fullPath);
                }
            }

            zip.writeZip(filePath);
            return true;
        } catch (e) {
            console.error('Export failed', e);
            return false;
        }
    });

    ipcMain.handle(IPC.importData, async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import ScratchBook Data',
            properties: ['openFile'],
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });

        if (!filePaths || filePaths.length === 0) {
            return false;
        }

        // Extract into a temporary staging folder first. 
        // The live data folder is only replaced once the whole import has succeeded.
        const dataDir = resolve(getDirectoryPath());
        const stagingDir = dataDir + '.import';
        try {
            const zip = new AdmZip(filePaths[0]);

            // Reject the whole archive if any entry would land outside the data folder.
            const unsafe = findBadPaths(zip.getEntries().map((entry) => entry.entryName), stagingDir);
            if (unsafe.length > 0) {
                console.error('Import rejected: unsafe entries', unsafe);
                return false;
            }

            await fsp.rm(stagingDir, { recursive: true, force: true });
            await fsp.mkdir(stagingDir, { recursive: true });
            zip.extractAllTo(stagingDir, true);

            // Force touch the sync token to trigger renderer reload
            const syncTokenPath = join(stagingDir, FILES.syncToken);
            await fsp.writeFile(syncTokenPath, syncTokenPayload({ timestamp: new Date().toISOString(), import: true }));

            // Keep this device's settings. Otherwise the backup's settings.json would replace them.
            const localSettingsPath = join(dataDir, FILES.settings);
            if (fs.existsSync(localSettingsPath)) {
                await fsp.copyFile(localSettingsPath, join(stagingDir, FILES.settings));
            }

            // Swap the staged import into place.
            await fsp.rm(dataDir, { recursive: true, force: true });
            await fsp.rename(stagingDir, dataDir);

            return true;
        } catch (e) {
            console.error('Import failed', e);
            await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
            return false;
        }
    });

    ipcMain.handle(IPC.openExternal, async (_, url) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return false; // reject malformed URLs
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false; // block non-web protocols (file:, javascript:, etc.)
        }
        await shell.openExternal(url);
        return true;
    });

    ipcMain.on(IPC.setWatcherEnabled, (_, enabled) => {
        if (enabled) {
            startWatcher();
        } else {
            stopWatcher();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Watcher Management
    let watcher = null;
    let syncTimeout;

    function startWatcher() {
        if (watcher) {
            return;
        }
        const syncTokenPath = join(getDirectoryPath(), FILES.syncToken);
        console.log('Main: Starting file watcher on', syncTokenPath);
        watcher = chokidar.watch(syncTokenPath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        watcher.on('change', () => {
            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }
            syncTimeout = setTimeout(() => {
                console.log('Sync token changed on disk, notifying renderer');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(IPC.syncStateChanged);
                }
            }, 300);
        });
    }

    function stopWatcher() {
        if (watcher) {
            console.log('Main: Stopping file watcher');
            watcher.close();
            watcher = null;
        }
    }

    // Initial watcher state from settings.json. A missing file or key means the shared default.
    try {
        const settingsPath = join(getDirectoryPath(), FILES.settings);
        const text = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null;
        if (readSettings(text)[SETTINGS.enableWatcher] === true) {
            startWatcher();
        }
    } catch (e) {
        console.error('Failed to read settings.json for watcher initialization', e);
        startWatcher(); // Default safely
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
