import { resolve, relative, isAbsolute, sep } from 'path';

/**
 * Returns the entry names that would be written outside `rootDir` when a zip
 * is extracted into it. An empty result means every entry stays inside the root.
 *
 * @param {string[]} entryNames names exactly as stored in the zip
 * @param {string} rootDir directory the zip will be extracted into
 * @returns {string[]} unsafe entry names, in the order given
 */
export function findBadPaths(entryNames, rootDir) {
    const root = resolve(rootDir);
    return entryNames.filter((name) => {
        const rel = relative(root, resolve(root, name));
        return rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
    });
}
