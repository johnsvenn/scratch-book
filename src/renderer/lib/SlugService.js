import db from './db.js';

/**
 * Convert a page title into a URL-safe base slug.
 * - Lowercased
 * - Any run of non-alphanumeric characters replaced with a single hyphen
 * - Leading / trailing hyphens stripped
 * - Collapsed to 80 chars max
 *
 * @param {string} title
 * @returns {string}
 */
export function toBaseSlug(title) {
    if (!title || !title.trim()) {
        return 'page';
    }
    return title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'page';
}

/**
 * Generate a slug that is guaranteed to be unique in the database.
 *
 * Starting from the base slug derived from `title`, tries:
 *   <base>, <base>-1, <base>-2, …
 * until a free slot is found.
 *
 * @param {string} title - Page title used to derive the base slug.
 * @param {string} [excludeFilename] - Filename of the page being edited so its
 *   own current slug is not treated as a conflict.
 * @returns {Promise<string>} A unique slug string.
 */
export async function generateUniqueSlug(title, excludeFilename = null) {
    const base = toBaseSlug(title);

    // Try the plain base first
    if (!(await db.isSlugTaken(base, excludeFilename))) {
        return base;
    }

    // Append incrementing suffix until free
    let i = 1;
    while (true) {
        const candidate = `${base}-${i}`;
        if (!(await db.isSlugTaken(candidate, excludeFilename))) {
            return candidate;
        }
        i++;
    }
}

export default { toBaseSlug, generateUniqueSlug };
