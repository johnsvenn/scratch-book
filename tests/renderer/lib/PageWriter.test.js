import { describe, it, expect, beforeEach } from 'vitest';
import { createPageWriter } from '../../../src/renderer/lib/Pages/PageWriter.js';
import Page from '../../../src/renderer/lib/Pages/Page.js';

// In-memory fakes at the seam: disk (filestore), store (IndexedDB pages), search.
function makeFakes() {
    const files = new Map();
    const rows = new Map();
    const searchCalls = { add: [], remove: [] };
    const syncCalls = { put: [], delete: [] };

    const disk = {
        saveFile: async (path, data) => { files.set(path, data); },
    };
    const store = {
        get: async (filename) => rows.get(filename),
        getAll: async () => [...rows.values()],
        put: async (page) => {
            rows.set(page.filename, JSON.parse(JSON.stringify(page)));
        },
        delete: async (filename) => {
            rows.delete(filename);
        },
    };
    // Writes that came from disk. These never touch the sync token.
    const syncStore = {
        put: async (page) => {
            rows.set(page.filename, JSON.parse(JSON.stringify(page)));
            syncCalls.put.push(page.filename);
        },
        delete: async (filename) => {
            rows.delete(filename);
            syncCalls.delete.push(filename);
        },
    };
    const search = {
        add: (page) => searchCalls.add.push(page.filename),
        remove: (filename) => searchCalls.remove.push(filename),
    };
    return { files, rows, searchCalls, syncCalls, disk, store, syncStore, search };
}

const FIXED_NOW = '2026-11-06T10:00:00.000';
const now = () => FIXED_NOW;

describe('PageWriter', () => {
    let fakes;
    let writer;

    beforeEach(() => {
        fakes = makeFakes();
        writer = createPageWriter({ disk: fakes.disk, store: fakes.store, syncStore: fakes.syncStore, search: fakes.search, now });
    });

    describe('save', () => {
        it('writes the page to disk, the store and search, and bumps modifiedAt', async () => {
            const page = new Page({ filename: 'p1', title: 'Hello', content: 'Body', tags: ['work'] });

            const saved = await writer.save(page);

            expect(saved.modifiedAt).toBe(FIXED_NOW);
            expect(fakes.files.get('p1/index.md')).toContain('Hello');
            expect(fakes.rows.get('p1')).toMatchObject({ filename: 'p1', title: 'Hello', modifiedAt: FIXED_NOW });
            expect(fakes.searchCalls.add).toEqual(['p1']);
        });

        it('writes nothing when the page is empty and was never stored', async () => {
            const page = new Page({ filename: 'new', title: '', content: '   ' });

            await writer.save(page);

            expect(fakes.files.size).toBe(0);
            expect(fakes.rows.size).toBe(0);
            expect(fakes.searchCalls.add).toEqual([]);
        });

        it('tombstones a stored page that has been emptied, so the old content is gone from disk and store', async () => {
            await writer.save(new Page({ filename: 'p2', title: 'Old', content: 'Old body' }));

            await writer.save(new Page({ filename: 'p2', title: '', content: '' }));

            expect(JSON.parse(fakes.files.get('p2/index.md'))).toMatchObject({ filename: 'p2', isDeleted: true });
            expect(fakes.files.get('p2/index.md')).not.toContain('Old body');
            expect(fakes.rows.has('p2')).toBe(false);
            expect(fakes.searchCalls.remove).toContain('p2');
        });
    });

    describe('remove', () => {
        it('leaves a tombstone on disk so other devices can delete their copy', async () => {
            await writer.save(new Page({ filename: 'p3', title: 'Bye', content: 'x' }));

            await writer.remove(new Page({ filename: 'p3', title: 'Bye', content: 'x' }));

            expect(JSON.parse(fakes.files.get('p3/index.md'))).toEqual({
                filename: 'p3',
                isDeleted: true,
                modifiedAt: FIXED_NOW,
            });
            expect(fakes.rows.has('p3')).toBe(false);
            expect(fakes.searchCalls.remove).toContain('p3');
        });
    });

    describe('renameTag', () => {
        beforeEach(async () => {
            await writer.save(new Page({ filename: 'a', title: 'A', content: 'a', tags: ['old', 'work'] }));
            await writer.save(new Page({ filename: 'b', title: 'B', content: 'b', tags: ['other'] }));
        });

        it('rewrites every page with the old tag to disk, store and search', async () => {
            const count = await writer.renameTag('old', 'new');

            expect(count).toBe(1);
            expect(JSON.parse(JSON.stringify(fakes.rows.get('a'))).tags).toEqual(['work', 'new']);
            expect(fakes.files.get('a/index.md')).toContain('new');
            expect(fakes.files.get('a/index.md')).not.toContain('"old"');
            expect(fakes.searchCalls.add.filter((f) => f === 'a').length).toBeGreaterThan(1);
        });

        it('does not touch pages that do not carry the old tag', async () => {
            const before = fakes.files.get('b/index.md');

            await writer.renameTag('old', 'new');

            expect(fakes.files.get('b/index.md')).toBe(before);
        });

        it('does not duplicate the new tag when a page already has it', async () => {
            await writer.save(new Page({ filename: 'c', title: 'C', content: 'c', tags: ['old', 'new'] }));

            await writer.renameTag('old', 'new');

            expect(fakes.rows.get('c').tags).toEqual(['new']);
        });
    });

    describe('removeTag', () => {
        it('removes the tag from every page on disk, in store and in search', async () => {
            await writer.save(new Page({ filename: 'x', title: 'X', content: 'x', tags: ['gone', 'keep'] }));

            const count = await writer.removeTag('gone');

            expect(count).toBe(1);
            expect(fakes.rows.get('x').tags).toEqual(['keep']);
            expect(fakes.files.get('x/index.md')).not.toContain('gone');
            expect(fakes.searchCalls.add.filter((f) => f === 'x').length).toBeGreaterThan(1);
        });
    });

    describe('import and forget (used by SyncService, no disk write)', () => {
        it('importFromDisk puts the page in the sync store and search, and never writes to disk', async () => {
            await writer.importFromDisk(new Page({ filename: 'imp', title: 'Imp', content: 'i' }));

            expect(fakes.rows.has('imp')).toBe(true);
            expect(fakes.syncCalls.put).toEqual(['imp']);
            expect(fakes.searchCalls.add).toEqual(['imp']);
            expect(fakes.files.size).toBe(0);
        });

        it('forget removes the page from the sync store and search, and never writes to disk', async () => {
            await writer.importFromDisk(new Page({ filename: 'gone', title: 'G', content: 'g' }));

            await writer.forget('gone');

            expect(fakes.rows.has('gone')).toBe(false);
            expect(fakes.syncCalls.delete).toEqual(['gone']);
            expect(fakes.searchCalls.remove).toContain('gone');
            expect(fakes.files.size).toBe(0);
        });
    });
});
