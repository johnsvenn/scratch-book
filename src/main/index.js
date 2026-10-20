'use strict';

import { app, BrowserWindow, ipcMain, shell, dialog, Menu, MenuItem } from 'electron';
import { dirname, join } from 'path';
import Constants from '../renderer/lib/constants';
import chokidar from 'chokidar';
import AdmZip from 'adm-zip';

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
        if (!inEditor) return;

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
                click: () => mainWindow.webContents.send('insert-link')
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

function createScratchDirectory() {
    const directoryPath = getDirectoryPath();
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('save-file', async (_, filename, data) => {
        if (!filename || typeof filename !== 'string') return false;
        const filePath = join(getDirectoryPath(), filename);
        try {
            // Create the directory if it doesn't exist
            await fsp.mkdir(dirname(filePath), { recursive: true });
            await fsp.writeFile(filePath, data);
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('list-files', async () => {
        try {
            // Return files and directories
            return await fsp.readdir(getDirectoryPath());
        } catch (e) {
            return [];
        }
    });

    ipcMain.handle('get-file', async (_, filename) => {
        if (!filename || typeof filename !== 'string') return null;
        try {
            return await fsp.readFile(join(getDirectoryPath(), filename), 'utf8');
        } catch (e) {
            return null;
        }
    });

    ipcMain.handle('delete-file', async (_, filename) => {
        if (!filename || typeof filename !== 'string') return false;
        try {
            // we use rmSync instead of unlinkSync so we can delete directories cleanly
            await fsp.rm(join(getDirectoryPath(), filename), { recursive: true, force: true });
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('export-data', async () => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export ScratchBook Data',
            defaultPath: join(app.getPath('downloads'), 'scratchbook-backup.zip'),
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });

        if (!filePath) return false;

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

    ipcMain.handle('import-data', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import ScratchBook Data',
            properties: ['openFile'],
            filters: [{ name: 'Zip Files', extensions: ['zip'] }]
        });

        if (!filePaths || filePaths.length === 0) return false;

        try {
            const zip = new AdmZip(filePaths[0]);
            // Clear existing data directory
            await fsp.rm(getDirectoryPath(), { recursive: true, force: true });
            await fsp.mkdir(getDirectoryPath(), { recursive: true });
            // Extract
            zip.extractAllTo(getDirectoryPath(), true);

            // Force touch the sync token to trigger renderer reload
            const syncTokenPath = join(getDirectoryPath(), '_sync_state.json');
            await fsp.writeFile(syncTokenPath, JSON.stringify({ lastSyncTimestamp: new Date().toISOString(), import: true }, null, 2));

            return true;
        } catch (e) {
            console.error('Import failed', e);
            return false;
        }
    });

    ipcMain.handle('open-external', async (_, url) => {
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

    ipcMain.on('set-watcher-enabled', (_, enabled) => {
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
        if (watcher) return;
        const syncTokenPath = join(getDirectoryPath(), '_sync_state.json');
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
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                console.log('Sync token changed on disk, notifying renderer');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('sync-state-changed');
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

    // Initial watcher state from settings.json
    try {
        const settingsPath = join(getDirectoryPath(), 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            const watcherSetting = settings.find(s => s.key === 'enableWatcher');
            if (watcherSetting && watcherSetting.value === true) {
                startWatcher();
            } else if (!watcherSetting) {
                // Default to ON if setting not present yet
                startWatcher();
            }
        } else {
            // Default to ON for first run
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
