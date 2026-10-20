import Page from './Pages/Page.js';
import db from './db.js';
import search from './search.js';
import { RESERVED_TAGS } from './TagMeta.js';
import Constants from './constants.js';

const DEFAULT_INDEX_FILENAME = 'index.json';
const ARCHIVE_INDEX_FILENAME = 'archive.json';

// We rewrite PageIndex as a single global manager that interfaces with IndexedDB
const UnifiedIndex = {
    items: [],
    initialized: false,

    init: async function () {
        if (!this.initialized) {
            await this.read();
            this.initialized = true;
        }
    },

    read: async function () {
        let pages = await db.getAll();
        this.items = pages.map((p) => new Page(p));

        // By default, sort by 'current' tag order if possible
        const order = await db.getOrder(Constants.CURRENT_TAG);
        if (order) {
            const orderMap = new Map(order.map((filename, index) => [filename, index]));
            this.items.sort((a, b) => {
                const posA = orderMap.has(a.filename) ? orderMap.get(a.filename) : 999999;
                const posB = orderMap.has(b.filename) ? orderMap.get(b.filename) : 999999;
                return posA - posB;
            });
        } else {
            this.items.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return a.createdAt.localeCompare(b.createdAt);
            });
        }

        await search.init(this.items);
        return this.items;
    },

    append: async function (item, silent = false) {
        let newItem = new Page(item);
        this.items.push(newItem);
        if (!newItem.isEmpty()) {
            await db.put(newItem, silent);
            search.add(newItem);

            // Update 'current' order if it's not archived
            if (!newItem.tags || !newItem.tags.includes(Constants.ARCHIVE_TAG)) {
                const order = (await db.getOrder(Constants.CURRENT_TAG)) || [];
                if (!order.includes(newItem.filename)) {
                    order.push(newItem.filename);
                    await db.putOrder(Constants.CURRENT_TAG, order);
                }
            }
        }
    },

    prepend: async function (item, silent = false) {
        let newItem = new Page(item);
        this.items.unshift(newItem);
        if (!newItem.isEmpty()) {
            await db.put(newItem, silent);
            search.add(newItem);

            // Update 'current' order if it's not archived
            if (!newItem.tags || !newItem.tags.includes(Constants.ARCHIVE_TAG)) {
                const order = (await db.getOrder(Constants.CURRENT_TAG)) || [];
                if (!order.includes(newItem.filename)) {
                    order.unshift(newItem.filename);
                    await db.putOrder(Constants.CURRENT_TAG, order);
                }
            }
        }
    },

    delete: async function (item, silent = false) {
        this.items = this.items.filter((obj) => obj.filename !== item.filename);
        await db.delete(item.filename, silent);
        search.remove(item.filename);

        // Remove from tag orders
        const tags = [Constants.CURRENT_TAG, Constants.ARCHIVE_TAG, Constants.FAVOURITE_TAG]; // And any others later
        for (const tag of tags) {
            const order = await db.getOrder(tag);
            if (order && order.includes(item.filename)) {
                await db.putOrder(tag, order.filter(f => f !== item.filename));
            }
        }
    },

    move: function () {
        // To be implemented or handled UI side
    },

    update: async function (item, silent = false) {
        let newItem = new Page(item);
        const idx = this.items.findIndex((existing) => existing.filename === newItem.filename);
        if (idx !== -1) {
            this.items[idx] = newItem;
        } else {
            this.items.push(newItem);
        }

        if (newItem.isEmpty()) {
            // Remove from database and search if it's empty now
            await db.delete(newItem.filename, silent);
            search.remove(newItem.filename);
            // Also remove it from memory so it's fully excluded from the app state
            this.items = this.items.filter((obj) => obj.filename !== newItem.filename);
        } else {
            await db.put(newItem, silent);
            search.add(newItem);
        }
    },

    save: async function () {
    },

    setItems: async function (items) {
        this.items = items.map((i) => new Page(i)).filter((item) => !item.isEmpty());
        await db.clear();
        for (const item of this.items) {
            await db.put(item);
        }
        await search.init(this.items);
    },

    list: function () {
        return this.items;
    },

    filterByTag: async function (tag) {
        if (!tag) return this.items.filter(item => !item.tags || !item.tags.includes(Constants.ARCHIVE_TAG));

        const filtered = this.items.filter(item => {
            const hasTag = item.tags && item.tags.includes(tag);
            const isArchived = item.tags && item.tags.includes(Constants.ARCHIVE_TAG);

            if (tag === Constants.ARCHIVE_TAG) return isArchived;
            return hasTag && !isArchived;
        });

        // Load custom order for the specific tag
        const order = await db.getOrder(tag);
        if (order) {
            const orderMap = new Map(order.map((filename, index) => [filename, index]));
            filtered.sort((a, b) => {
                const posA = orderMap.has(a.filename) ? orderMap.get(a.filename) : 999999;
                const posB = orderMap.has(b.filename) ? orderMap.get(b.filename) : 999999;
                return posA - posB;
            });
        }
        return filtered;
    },

    saveTagOrder: async function (tag, items) {
        const filenames = items.map(p => p.filename);
        await db.putOrder(tag, filenames);

        // If we are reordering 'current', update the in-memory order of this.items
        // since the main defaultIndex.list() relies on this.items's order.
        if (tag === Constants.CURRENT_TAG) {
            const orderMap = new Map(filenames.map((filename, index) => [filename, index]));
            this.items.sort((a, b) => {
                const posA = orderMap.has(a.filename) ? orderMap.get(a.filename) : 999999;
                const posB = orderMap.has(b.filename) ? orderMap.get(b.filename) : 999999;
                return posA - posB;
            });
        }
    },

    search: function (query) {
        if (!query) return this.items;
        const results = search.search(query);
        const resultIds = new Set(results.map(r => r.id));
        return this.items.filter(item => resultIds.has(item.filename));
    },

    /**
     * Returns all unique user-defined tags (excluding reserved ones),
     * sorted by the number of pages using them (descending).
     * @returns {{ name: string, count: number }[]}
     */
    getAllUserTags: function () {
        const counts = new Map();
        for (const item of this.items) {
            if (!item.tags) continue;
            for (const tag of item.tags) {
                if (RESERVED_TAGS.has(tag)) continue;
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return [...counts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    },

    /**
     * Returns an index facade that filters by a specific user tag.
     * Behaves like defaultIndex/archiveIndex but for any arbitrary tag name.
     * @param {string} tagName
     * @returns {object} index facade
     */
    getTagIndex: function (tagName) {
        return {
            init: async () => UnifiedIndex.init(),
            append: async (item) => {
                if (!item.tags) item.tags = [];
                if (!item.tags.includes(tagName)) item.tags.push(tagName);
                await UnifiedIndex.append(item);
            },
            delete: async (item) => UnifiedIndex.delete(item),
            update: async (item) => UnifiedIndex.update(item),
            save: async () => UnifiedIndex.save(),
            list: () => UnifiedIndex.items.filter(
                (item) =>
                    item.tags &&
                    item.tags.includes(tagName) &&
                    !item.tags.includes(Constants.ARCHIVE_TAG)
            ),
            filter: async (tag) => UnifiedIndex.filterByTag(tag),
            saveTagOrder: async (tag, items) => UnifiedIndex.saveTagOrder(tag, items),
            tagName,
            indexFileName: `tag_${tagName}.json`,
        };
    },
};

const defaultIndex = {
    init: async () => UnifiedIndex.init(),
    read: async () => {
        await UnifiedIndex.read();
        return defaultIndex.list();
    },
    append: async (item) => UnifiedIndex.append(item),
    prepend: async (item) => UnifiedIndex.prepend(item),
    delete: async (item) => UnifiedIndex.delete(item),
    update: async (item) => UnifiedIndex.update(item),
    move: (item, index) => UnifiedIndex.move(item, index),
    save: async () => UnifiedIndex.save(),
    setItems: async (items) => UnifiedIndex.setItems(items),
    list: () => UnifiedIndex.items.filter(item => (!item.tags || !item.tags.includes(Constants.ARCHIVE_TAG)) && (item.tags && item.tags.includes(Constants.CURRENT_TAG))),
    filter: async (tag) => UnifiedIndex.filterByTag(tag),
    saveTagOrder: async (tag, items) => UnifiedIndex.saveTagOrder(tag, items),
    search: (query) => UnifiedIndex.search(query).filter(item => (!item.tags || !item.tags.includes(Constants.ARCHIVE_TAG)) && (item.tags && item.tags.includes(Constants.CURRENT_TAG))),
    tagName: Constants.CURRENT_TAG,
    indexFileName: DEFAULT_INDEX_FILENAME
};

const archiveIndex = {
    init: async () => UnifiedIndex.init(),
    read: async () => {
        await UnifiedIndex.read();
        return archiveIndex.list();
    },
    append: async (item) => {
        item.tags = [...new Set([...(item.tags || []), Constants.ARCHIVE_TAG])];
        item.tags = item.tags.filter(t => t !== Constants.CURRENT_TAG);
        await UnifiedIndex.append(item);
    },
    prepend: async (item) => {
        item.tags = [...new Set([...(item.tags || []), Constants.ARCHIVE_TAG])];
        item.tags = item.tags.filter(t => t !== Constants.CURRENT_TAG);
        await UnifiedIndex.prepend(item);
    },
    delete: async (item) => UnifiedIndex.delete(item),
    update: async (item) => UnifiedIndex.update(item),
    move: (item, index) => UnifiedIndex.move(item, index),
    save: async () => UnifiedIndex.save(),
    setItems: async (items) => UnifiedIndex.setItems(items),
    list: () => UnifiedIndex.items.filter(item => item.tags && item.tags.includes(Constants.ARCHIVE_TAG)),
    filter: async (tag) => UnifiedIndex.filterByTag(tag),
    saveTagOrder: async (tag, items) => UnifiedIndex.saveTagOrder(tag, items),
    search: (query) => UnifiedIndex.search(query).filter(item => item.tags && item.tags.includes(Constants.ARCHIVE_TAG)),
    tagName: Constants.ARCHIVE_TAG,
    indexFileName: ARCHIVE_INDEX_FILENAME
};

export { defaultIndex, archiveIndex, UnifiedIndex, DEFAULT_INDEX_FILENAME, ARCHIVE_INDEX_FILENAME };
