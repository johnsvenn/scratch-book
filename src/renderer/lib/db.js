import { openDB } from 'idb';
import filestore from './filestore.js';
import SyncToken from './SyncToken.js';

const DB_NAME = 'scratchbook_db';
const DB_VERSION = 5;
const STORE_NAME = 'pages';

let dbPromise;

const db = {
    init: async () => {
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
    },

    getAll: async () => {
        await db.init();
        const database = await dbPromise;
        return database.getAll(STORE_NAME);
    },

    getPageMetaMap: async () => {
        await db.init();
        const database = await dbPromise;
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
        await db.init();
        const database = await dbPromise;
        return database.get(STORE_NAME, filename);
    },

    put: async (page, silent = false) => {
        await db.init();
        const database = await dbPromise;
        // Ensure we save a plain object without any potential non-serializable baggage from constructor instances
        const plainPage = JSON.parse(JSON.stringify(page));
        await database.put(STORE_NAME, plainPage);
        // Note: Page writes to filestore already happen in PageService.js, but we should touch the sync token
        if (!silent) {
            await SyncToken.touch();
        }
    },

    delete: async (filename, silent = false) => {
        await db.init();
        const database = await dbPromise;
        await database.delete(STORE_NAME, filename);
        if (!silent) {
            await SyncToken.touch();
        }
    },

    clear: async () => {
        await db.init();
        const database = await dbPromise;
        await database.clear(STORE_NAME);
    },

    clearAll: async () => {
        await db.init();
        const database = await dbPromise;
        await database.clear(STORE_NAME);
        await database.clear('orderings');
        await database.clear('tag_meta');
    },

    // Orderings for tags
    putOrder: async (tag, filenames, silent = false) => {
        await db.init();
        const database = await dbPromise;
        await database.put('orderings', { tag, filenames });
        
        if (!silent) {
            // Mirror all orderings to the filesystem
            const allOrderings = await database.getAll('orderings');
            await filestore.saveFile('orderings.json', JSON.stringify(allOrderings, null, 2));
            await SyncToken.touch();
        }
    },

    getOrder: async (tag) => {
        await db.init();
        const database = await dbPromise;
        const entry = await database.get('orderings', tag);
        return entry ? entry.filenames : null;
    },

    // Tag metadata (name → color)
    getAllTagMeta: async () => {
        await db.init();
        const database = await dbPromise;
        return database.getAll('tag_meta');
    },

    getTagMeta: async (name) => {
        await db.init();
        const database = await dbPromise;
        return database.get('tag_meta', name);
    },

    putTagMeta: async (meta, silent = false) => {
        await db.init();
        const database = await dbPromise;
        await database.put('tag_meta', meta);

        if (!silent) {
            // Mirror to filesystem
            const allMeta = await database.getAll('tag_meta');
            await filestore.saveFile('tag_meta.json', JSON.stringify(allMeta, null, 2));
            await SyncToken.touch();
        }
    },

    deleteTagMeta: async (name, silent = false) => {
        await db.init();
        const database = await dbPromise;
        await database.delete('tag_meta', name);

        if (!silent) {
            // Mirror to filesystem
            const allMeta = await database.getAll('tag_meta');
            await filestore.saveFile('tag_meta.json', JSON.stringify(allMeta, null, 2));
            await SyncToken.touch();
        }
    },

    // Global Settings
    getSetting: async (key) => {
        await db.init();
        const database = await dbPromise;
        const entry = await database.get('settings', key);
        return entry ? entry.value : null;
    },

    putSetting: async (key, value) => {
        await db.init();
        const database = await dbPromise;
        await database.put('settings', { key, value });

        // Mirror to filesystem
        const allSettings = await database.getAll('settings');
        await filestore.saveFile('settings.json', JSON.stringify(allSettings, null, 2));
        // We don't touch the sync token for pure settings as it doesn't represent a data change others need to reconcile usually, 
        // but for watcher toggle, the Main process will watch settings.json directly or via IPC.
    },
    /**
     * Look up a page by its slug using the dedicated index.
     * @param {string} slug
     * @returns {Promise<object|undefined>}
     */
    getBySlug: async (slug) => {
        await db.init();
        const database = await dbPromise;
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
        if (!slug) return false;
        const existing = await db.getBySlug(slug);
        if (!existing) return false;
        if (excludeFilename && existing.filename === excludeFilename) return false;
        return true;
    },
};

export default db;
