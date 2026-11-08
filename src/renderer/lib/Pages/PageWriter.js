import Datetime from '../DatetimeFunctions.js';
import filestore from '../filestore.js';
import db from '../db.js';
import search from '../search.js';
import fileFormatter from '../fileFormatter.js';
import Page from './Page.js';
import { tombstonePayload } from '../../../shared/protocol.js';

/**
 * The only module that writes page data.
 *
 * Every write goes to disk, the page store (IndexedDB) and search together.
 * Callers never touch those three directly.
 *
 * Rules owned here:
 * - An empty page (no title and no content) is never kept. If a stored page
 *   becomes empty, it is tombstoned.
 * - Delete also writes a tombstone, so other devices remove their copy.
 *
 * A tombstone is a deletion marker, not a page: `{ filename, isDeleted: true,
 * modifiedAt }` written in place of `index.md`. Sync reads it (see SyncService)
 * and removes the page from its own store and search.
 * - Saving a page bumps its modifiedAt.
 *
 * Not owned here: the in-memory list (PageIndex), tag colours (TagMeta) and
 * tag ordering. Those are not page rows.
 *
 * @param {object} seam
 * @param {{ saveFile: (path: string, data: string) => Promise<void> }} seam.disk
 * @param {{ get, getAll, put: (page) => Promise, delete: (filename) => Promise }} seam.store
 * @param {{ put: (page) => Promise, delete: (filename) => Promise }} seam.syncStore writes that came from disk (IndexedDB only)
 * @param {{ add: (page) => void, remove: (filename) => void }} seam.search
 * @param {() => string} [seam.now] clock, injectable for tests
 */
export function createPageWriter({ disk, store, syncStore, search: searchIndex, now = () => new Datetime().getDateTimeString() }) {
    /**
     * Replace a page's `index.md` with a deletion marker (see the module notes),
     * then drop the page from store and search.
     */
    async function writeTombstone(filename) {
        const payload = tombstonePayload({ filename, modifiedAt: now() });
        await disk.saveFile(`${filename}/index.md`, JSON.stringify(payload, null, 2));
        await store.delete(filename);
        searchIndex.remove(filename);
    }

    async function retag(tagName, transform) {
        const rows = await store.getAll();
        const affected = rows.map((row) => new Page(row)).filter((page) => page.tags && page.tags.includes(tagName));
        for (const page of affected) {
            page.tags = transform(page.tags);
            await save(page);
        }
        return affected.length;
    }

    async function save(item) {
        const page = new Page(item);
        page.modifiedAt = now();

        if (page.isEmpty()) {
            if (await store.get(page.filename)) {
                await writeTombstone(page.filename);
            }
            return page;
        }

        await disk.saveFile(`${page.filename}/index.md`, fileFormatter.prepareItem(page));
        await store.put(page);
        searchIndex.add(page);
        return page;
    }

    return {
        /**
         * Save a page to disk, store and search. Empty stored pages are tombstoned.
         * @param {Page|object} item
         * @returns {Promise<Page>} the saved page, with modifiedAt set
         */
        save,

        /**
         * Delete a page. Leaves a tombstone on disk so other devices remove it too.
         * @param {Page|object} item
         */
        async remove(item) {
            await writeTombstone(new Page(item).filename);
        },

        /**
         * Rename a tag on every page that uses it.
         * @returns {Promise<number>} number of pages changed
         */
        renameTag(oldName, newName) {
            return retag(oldName, (tags) => {
                const next = tags.filter((t) => t !== oldName);
                if (!next.includes(newName)) {
                    next.push(newName);
                }
                return next;
            });
        },

        /**
         * Remove a tag from every page that uses it.
         * @returns {Promise<number>} number of pages changed
         */
        removeTag(tagName) {
            return retag(tagName, (tags) => tags.filter((t) => t !== tagName));
        },

        /**
         * Store a page that was read from disk during sync. Silent, and never written back to disk.
         * @param {Page} page
         */
        async importFromDisk(page) {
            if (page.isEmpty()) {
                await syncStore.delete(page.filename);
                searchIndex.remove(page.filename);
                return;
            }
            await syncStore.put(page);
            searchIndex.add(page);
        },

        /**
         * Drop a page from store and search after sync saw its tombstone. Silent, no disk write.
         * @param {string} filename
         */
        async forget(filename) {
            await syncStore.delete(filename);
            searchIndex.remove(filename);
        },
    };
}

const pageWriter = createPageWriter({ disk: filestore, store: db, syncStore: db.fromSync, search });

export default pageWriter;
