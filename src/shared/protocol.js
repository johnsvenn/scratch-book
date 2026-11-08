/**
 * The contract between the main process and the renderer.
 *
 * Covers IPC channel names, file names, setting keys and defaults, and the
 * on-disk shapes of settings.json, the sync token and tombstones.
 *
 * Plain JavaScript with no imports, so it can be bundled into main, preload
 * and renderer alike.
 */

// IPC channel names. Used by src/main/preload.js, src/main/index.js and the renderer.
export const IPC = {
    saveFile: 'save-file',
    listFiles: 'list-files',
    getFile: 'get-file',
    deleteFile: 'delete-file',
    exportData: 'export-data',
    importData: 'import-data',
    openExternal: 'open-external',
    setWatcherEnabled: 'set-watcher-enabled',
    // Main to renderer
    insertLink: 'insert-link',
    syncStateChanged: 'sync-state-changed',
};

// Events main sends to the renderer. The preload only lets the renderer listen to these.
export const EVENTS = new Set([IPC.insertLink, IPC.syncStateChanged]);

// Files in the data directory.
// orderings.json: array of { tag, filenames }. tag_meta.json: array of tag metadata rows.
// Both are JSON mirrors of IndexedDB tables, written by db.js and read by SyncService.
export const FILES = {
    syncToken: '_sync_state.json',
    settings: 'settings.json',
    orderings: 'orderings.json',
    tagMeta: 'tag_meta.json',
};

// Setting keys. settings.json is the only store for settings.
export const SETTINGS = {
    enableWatcher: 'enableWatcher',
};

// Used when a setting is missing from settings.json. Main and the renderer both read these.
export const SETTING_DEFAULTS = {
    [SETTINGS.enableWatcher]: true,
};

function parseEntries(text) {
    if (!text) {
        return [];
    }
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * settings.json holds an array of `{ key, value }` entries.
 *
 * @param {string|null|undefined} text contents of settings.json, or null if the file is missing
 * @returns {Record<string, unknown>} every setting, with defaults for keys not in the file
 */
export function readSettings(text) {
    const values = {};
    for (const entry of parseEntries(text)) {
        if (entry && typeof entry.key === 'string') {
            values[entry.key] = entry.value;
        }
    }
    return { ...SETTING_DEFAULTS, ...values };
}

/**
 * The settings.json contents after setting one key. Other entries are kept.
 *
 * @param {string|null|undefined} text current contents of settings.json
 * @param {string} key
 * @param {unknown} value
 * @returns {string} JSON text to write back to settings.json
 */
export function writeSetting(text, key, value) {
    const entries = parseEntries(text);
    const index = entries.findIndex((entry) => entry && entry.key === key);
    if (index === -1) {
        entries.push({ key, value });
    } else {
        entries[index] = { key, value };
    }
    return JSON.stringify(entries, null, 2);
}

/**
 * The sync token file. Writing it tells watchers that the data changed.
 * A token with `import: true` tells the renderer to clear local state first.
 *
 * @param {{ timestamp: string, import?: boolean }} fields
 * @returns {string} JSON text to write to _sync_state.json
 */
export function syncTokenPayload({ timestamp, import: isImport = false }) {
    const payload = { lastSyncTimestamp: timestamp };
    if (isImport) {
        payload.import = true;
    }
    return JSON.stringify(payload, null, 2);
}

/**
 * @param {string|null|undefined} text contents of _sync_state.json
 * @returns {boolean} true if the token asks for a full import
 */
export function isImportToken(text) {
    try {
        return !!JSON.parse(text).import;
    } catch {
        return false;
    }
}

/**
 * A tombstone is a deletion marker written in place of a page's index.md.
 *
 * @param {{ filename: string, modifiedAt: string }} fields
 * @returns {{ filename: string, isDeleted: true, modifiedAt: string }}
 */
export function tombstonePayload({ filename, modifiedAt }) {
    return { filename, isDeleted: true, modifiedAt };
}

/**
 * @param {object|null|undefined} meta page metadata read from disk
 * @returns {boolean} true if the page on disk is a tombstone
 */
export function isTombstone(meta) {
    return !!meta && !!meta.isDeleted;
}
