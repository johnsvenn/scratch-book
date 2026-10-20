import db from './db.js';
import Constants from './constants.js';

/**
 * Preset colour palette for tags.
 * These match the style of the design mockup (muted, distinct, not garish).
 */
export const TAG_COLORS = [
    '#9b7fd4', // purple  (ideas)
    '#4caf82', // green   (work)
    '#e09c3a', // amber   (reading)
    '#8c8c8c', // grey    (research)
    '#e05c8a', // pink    (personal)
    '#4a9ecf', // blue
    '#cf6b4a', // rust
    '#6bba6b', // lime
];

/**
 * Reserved tag names that should never appear as user tabs or receive colours.
 */
export const RESERVED_TAGS = new Set([Constants.CURRENT_TAG, Constants.ARCHIVE_TAG, Constants.FAVOURITE_TAG]);

/**
 * Deterministically picks a colour for a tag name from the palette.
 * Used as a fallback before the colour has been persisted in IndexedDB.
 *
 * @param {string} tagName
 * @returns {string} hex colour
 */
export function getAutoColor(tagName) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = (hash * 31 + tagName.charCodeAt(i)) >>> 0;
    }
    return TAG_COLORS[hash % TAG_COLORS.length];
}

const TagMeta = {
    /**
     * In-memory cache: Map<tagName, color>
     */
    _cache: null,

    /**
     * Load all tag meta from IndexedDB into the cache and return the Map.
     * @returns {Promise<Map<string, string>>}
     */
    async getAll() {
        if (!this._cache) {
            const rows = await db.getAllTagMeta();
            this._cache = new Map(rows.map((r) => [r.name, r.color]));
        }
        return this._cache;
    },

    /**
     * Get the colour for a single tag, falling back to the auto colour.
     * @param {string} tagName
     * @returns {Promise<string>}
     */
    async getColor(tagName) {
        const all = await this.getAll();
        return all.get(tagName) ?? getAutoColor(tagName);
    },

    /**
     * Persist a tag's colour and update the cache.
     * @param {string} tagName
     * @param {string} color
     */
    async set(tagName, color) {
        await db.putTagMeta({ name: tagName, color });
        const cache = await this.getAll();
        cache.set(tagName, color);
    },

    /**
     * Remove a tag's metadata from the store and the cache.
     * @param {string} tagName
     */
    async remove(tagName) {
        await db.deleteTagMeta(tagName);
        const cache = await this.getAll();
        cache.delete(tagName);
    },

    /**
     * Ensure every tag in the provided set has a persisted colour.
     * Tags that are not yet in the DB get the auto colour assigned and saved.
     * @param {string[]} tagNames
     * @returns {Promise<Map<string, string>>}
     */
    async ensureColors(tagNames) {
        const all = await this.getAll();
        const saves = [];
        for (const name of tagNames) {
            if (!all.has(name)) {
                const color = getAutoColor(name);
                all.set(name, color);
                saves.push(db.putTagMeta({ name, color }));
            }
        }
        await Promise.all(saves);
        return all;
    },

    /**
     * Flush the in-memory cache (useful for testing).
     */
    reset() {
        this._cache = null;
    },
};

export default TagMeta;
