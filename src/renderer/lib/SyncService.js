import db from './db.js';
import filestore from './filestore.js';
import fileFormatter from './fileFormatter.js';
import { UnifiedIndex } from './PageIndex.js';
import Page from './Pages/Page.js';
import pageWriter from './Pages/PageWriter.js';
import { FILES, IPC, isImportToken, isTombstone } from '../../shared/protocol.js';

async function runWithConcurrency(items, limit, worker) {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            await worker(item);
        }
    });
    await Promise.all(workers);
}

const SyncService = {
    initialized: false,
    unsubscribeSyncListener: null,

    init() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        if (window.electronAPI && window.electronAPI.on) {
            const disposer = window.electronAPI.on(IPC.syncStateChanged, () => {
                console.log('Sync event received in renderer');
                this.performSync();
            });
            if (typeof disposer === 'function') {
                this.unsubscribeSyncListener = disposer;
            }
        }
    },

    teardown() {
        if (typeof this.unsubscribeSyncListener === 'function') {
            this.unsubscribeSyncListener();
        }
        this.unsubscribeSyncListener = null;
        this.initialized = false;
    },

    async performSync(forceFullSync = false) {
        console.log('Starting filesystem sync scan...');

        let isFullImport = false;
        try {
            const tokenFile = await filestore.getFile(FILES.syncToken);
            if (isImportToken(tokenFile)) {
                isFullImport = true;
                console.log('Sync: Full import detected, clearing local state');
            }
        } catch (e) {
            // Token might be missing or malformed
        }

        if (isFullImport || forceFullSync) {
            await db.clearAll();
            UnifiedIndex.items = [];
        }

        // 1. Sync Tag Meta
        try {
            const tagMetaFile = await filestore.getFile(FILES.tagMeta);
            if (tagMetaFile) {
                const tagMeta = JSON.parse(tagMetaFile);
                if (Array.isArray(tagMeta)) {
                    await Promise.all(tagMeta.map((meta) => db.fromSync.putTagMeta(meta)));
                }
            }
        } catch (e) {
            console.error('Failed to sync tag_meta.json', e);
        }

        // 2. Sync Orderings
        try {
            const orderingsFile = await filestore.getFile(FILES.orderings);
            if (orderingsFile) {
                const orderings = JSON.parse(orderingsFile);
                if (Array.isArray(orderings)) {
                    await Promise.all(orderings.map((entry) => db.fromSync.putOrder(entry.tag, entry.filenames)));
                }
            }
        } catch (e) {
            console.error('Failed to sync orderings.json', e);
        }

        // 3. Sync Pages
        try {
            const files = await filestore.listFiles();
            // Look for directories that are UUIDs (page bundles)
            // Filter out system files or specific json files
            const pageDirs = files.filter(f => !f.endsWith('.json') && !f.startsWith('.'));
            const existingPages = await db.getPageMetaMap();

            await runWithConcurrency(pageDirs, 8, async (dirName) => {
                const pageFile = await filestore.getFile(`${dirName}/index.md`);
                if (!pageFile) {
                    return;
                }

                const [meta, content] = fileFormatter.extract(pageFile);
                if (!meta || typeof meta !== 'object') {
                    return;
                }
                if (!meta.filename) {
                    // Backward compatibility for older soft-delete payloads.
                    meta.filename = dirName;
                }

                // Attach content if it was found
                meta.content = content;

                const existingPage = existingPages.get(meta.filename);
                
                if (isTombstone(meta)) {
                    // Handle soft delete
                    if (existingPage) {
                        console.log('Sync: Removing soft-deleted page', meta.filename);
                        await pageWriter.forget(meta.filename);
                        await UnifiedIndex.delete(meta);
                    }
                    return;
                }

                if (!existingPage || (meta.modifiedAt && (!existingPage.modifiedAt || meta.modifiedAt > existingPage.modifiedAt))) {
                    console.log('Sync: Updating page from disk', meta.filename);
                    const newPage = new Page(meta);
                    await pageWriter.importFromDisk(newPage);
                    await UnifiedIndex.update(newPage);
                }
            });
        } catch (e) {
            console.error('Failed to sync pages', e);
        }

        console.log('Sync scan complete.');
    }
};

export default SyncService;
