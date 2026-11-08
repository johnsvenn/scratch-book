import { openDB } from 'idb';
import filestore from './filestore.js';
import SyncToken from './SyncToken.js';
import { FILES, readSettings, writeSetting } from '../../shared/protocol.js';

const DB_NAME = 'scratchbook_db';
const DB_VERSION = 5;
const STORE_NAME = 'pages';

let dbPromise;

function getDatabase() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            blocked() {
                console.warn('IndexedDB upgrade blocked — close other tabs.');
            },
            upgrade(database, oldVersion, _newVersion, transaction) {
                if (oldVersion < 1) {
                    // we will use the filename as the key path which will be the "slug"
                    const store = database.createObjectStore(STORE_NAME, {
                        keyPath: 'filename',
                    });
                    // create some indexes for faster querying
                    store.createIndex('modifiedAt', 'modifiedAt');
                    store.createIndex('tags', 'tags', { multiEntry: true });
                }
                if (oldVersion < 2) {
                    database.createObjectStore('orderings', { keyPath: 'tag' });
                }
                if (oldVersion < 3) {
                    database.createObjectStore('tag_meta', { keyPath: 'name' });
                }
                if (oldVersion < 4) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }
                if (oldVersion < 5) {
                    // Sparse unique index on slug — rows without a slug field are
                    // simply absent from the index, so no migration is required.
                    const pagesStore = transaction.objectStore(STORE_NAME);
                    pagesStore.createIndex('slug', 'slug', { unique: true });
                }
            },
        });
    }
    return dbPromise;
                }

// A plain copy, so no class instances or other non-serialisable data reach IndexedDB.
const plain = (value) => JSON.parse(JSON.stringify(value));

// Rewrite a JSON mirror of a table. Sync reads these files from disk.
async function mirror(database, table, fileName) {
    const rows = await database.getAll(table);
    await filestore.saveFile(fileName, JSON.stringify(rows, null, 2));
}

/**
 * Local writes. Each one touches the sync token so other devices pick up the change.
 * Tables that sync reads (orderings, tag metadata) are also mirrored to their JSON file.
 */
const local = {
    put: async (page) => {
        const database = await getDatabase();
        await database.put(STORE_NAME, plain(page));
        // The page file itself is written by PageWriter.
        await SyncToken.touch();
    },

    delete: async (filename) => {
        const database = await getDatabase();
        await database.delete(STORE_NAME, filename);
        await SyncToken.touch();
    },

    putOrder: async (tag, filenames) => {
        const database = await getDatabase();
        await database.put('orderings', { tag, filenames });
        await mirror(database, 'orderings', FILES.orderings);
        await SyncToken.touch();
    },

    putTagMeta: async (meta) => {
        const database = await getDatabase();
        await database.put('tag_meta', meta);
        await mirror(database, 'tag_meta', FILES.tagMeta);
        await SyncToken.touch();
    },

    deleteTagMeta: async (name) => {
        const database = await getDatabase();
        await database.delete('tag_meta', name);
        await mirror(database, 'tag_meta', FILES.tagMeta);
        await SyncToken.touch();
    },
    };

/**
 * Writes that bring in data already on disk, from sync or an import.
 * They update IndexedDB only: nothing is written back to disk and the sync token is not touched.
 */
const fromSync = {
    put: async (page) => {
        const database = await getDatabase();
        await database.put(STORE_NAME, plain(page));
    },

    delete: async (filename) => {
        const database = await getDatabase();
        await database.delete(STORE_NAME, filename);
    },

    putOrder: async (tag, filenames) => {
        const database = await getDatabase();
        await database.put('orderings', { tag, filenames });
    },

    putTagMeta: async (meta) => {
        const database = await getDatabase();
        await database.put('tag_meta', meta);
    },
    };

const db = {
    init: async () => {
        await getDatabase();
    },

    getAll: async () => {
        const database = await getDatabase();
        return database.getAll(STORE_NAME);
    },

    getPageMetaMap: async () => {
        const database = await getDatabase();
        const tx = database.transaction(STORE_NAME, 'readonly');
        const metaMap = new Map();
        let cursor = await tx.store.openCursor();

        while (cursor) {
            const value = cursor.value || {};
            if (value.filename) {
                metaMap.set(value.filename, {
                    filename: value.filename,
                    modifiedAt: value.modifiedAt || null,
                });
            }
            cursor = await cursor.continue();
        }

        await tx.done;
        return metaMap;
    },

    get: async (filename) => {
        const database = await getDatabase();
        return database.get(STORE_NAME, filename);
    },

    clear: async () => {
        const database = await getDatabase();
        await database.clear(STORE_NAME);
    },

    clearAll: async () => {
        const database = await getDatabase();
        await database.clear(STORE_NAME);
        await database.clear('orderings');
        await database.clear('tag_meta');
    },

    getOrder: async (tag) => {
        const database = await getDatabase();
        const entry = await database.get('orderings', tag);
        return entry ? entry.filenames : null;
    },

    getAllTagMeta: async () => {
        const database = await getDatabase();
        return database.getAll('tag_meta');
    },

    getTagMeta: async (name) => {
        const database = await getDatabase();
        return database.get('tag_meta', name);
    },

    /**
     * Look up a page by its slug using the dedicated index.
     * @param {string} slug
     * @returns {Promise<object|undefined>}
     */
    getBySlug: async (slug) => {
        const database = await getDatabase();
        return database.getFromIndex(STORE_NAME, 'slug', slug);
    },

    /**
     * Returns true if the slug is already in use by a page other than
     * the one identified by excludeFilename.
     * @param {string} slug
     * @param {string} [excludeFilename]
     * @returns {Promise<boolean>}
     */
    isSlugTaken: async (slug, excludeFilename = null) => {
        if (!slug) {
            return false;
        }
        const existing = await db.getBySlug(slug);
        if (!existing) {
            return false;
        }
        if (excludeFilename && existing.filename === excludeFilename) {
            return false;
        }
        return true;
    },

    // Global settings live in settings.json. See src/shared/protocol.js.
    getSetting: async (key) => {
        const text = await filestore.getFile(FILES.settings);
        return readSettings(text)[key] ?? null;
    },

    putSetting: async (key, value) => {
        const text = await filestore.getFile(FILES.settings);
        const saved = await filestore.saveFile(FILES.settings, writeSetting(text, key, value));
        if (saved === false) {
            throw new Error(`Could not save setting "${key}" to ${FILES.settings}`);
        }
    },

    // Local writes (touch sync). The methods below are the same names as before.
    put: local.put,
    delete: local.delete,
    putOrder: local.putOrder,
    putTagMeta: local.putTagMeta,
    deleteTagMeta: local.deleteTagMeta,

    // Writes that came from disk. Use these for sync and import, never for local edits.
    fromSync,
    };

export default db;
