import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/lib/filestore.js', () => ({
    default: {
        saveFile: vi.fn(async () => true),
        getFile: vi.fn(async () => null),
    },
}));

vi.mock('../../../src/renderer/lib/SyncToken.js', () => ({
    default: {
        touch: vi.fn(async () => {}),
    },
}));

import db from '../../../src/renderer/lib/db.js';
import filestore from '../../../src/renderer/lib/filestore.js';
import SyncToken from '../../../src/renderer/lib/SyncToken.js';
import { FILES } from '../../../src/shared/protocol.js';

// The JSON last written to a mirror file, parsed.
function lastWrittenJson(fileName) {
    const calls = filestore.saveFile.mock.calls.filter(([name]) => name === fileName);
    expect(calls.length).toBeGreaterThan(0);
    return JSON.parse(calls[calls.length - 1][1]);
}

describe('db', () => {
    beforeEach(async () => {
        await db.clearAll();
        vi.clearAllMocks();
    });

    describe('local writes', () => {
        it('put stores a copy of the page and touches the sync token without writing a file', async () => {
            const page = { filename: 'a.md', tags: ['x'], modifiedAt: '2026-01-01' };
            await db.put(page);

            expect(await db.get('a.md')).toEqual(page);
            expect(SyncToken.touch).toHaveBeenCalledTimes(1);
            expect(filestore.saveFile).not.toHaveBeenCalled();
        });

        it('put stores a plain copy, not the caller object', async () => {
            const page = { filename: 'a.md', tags: ['x'] };
            await db.put(page);
            page.tags.push('y');

            expect((await db.get('a.md')).tags).toEqual(['x']);
        });

        it('delete removes the page and touches the sync token', async () => {
            await db.put({ filename: 'a.md' });
            vi.clearAllMocks();

            await db.delete('a.md');

            expect(await db.get('a.md')).toBeUndefined();
            expect(SyncToken.touch).toHaveBeenCalledTimes(1);
        });

        it('putOrder stores the ordering and mirrors every ordering to orderings.json', async () => {
            await db.putOrder('alpha', ['a.md', 'b.md']);
            await db.putOrder('beta', ['c.md']);

            expect(await db.getOrder('alpha')).toEqual(['a.md', 'b.md']);
            expect(lastWrittenJson(FILES.orderings)).toEqual([
                { tag: 'alpha', filenames: ['a.md', 'b.md'] },
                { tag: 'beta', filenames: ['c.md'] },
            ]);
            expect(SyncToken.touch).toHaveBeenCalledTimes(2);
        });

        it('putOrder replaces an existing ordering rather than adding a second one', async () => {
            await db.putOrder('alpha', ['a.md']);
            await db.putOrder('alpha', ['b.md', 'a.md']);

            expect(lastWrittenJson(FILES.orderings)).toEqual([{ tag: 'alpha', filenames: ['b.md', 'a.md'] }]);
        });

        it('putTagMeta stores the row and mirrors every row to tag_meta.json', async () => {
            await db.putTagMeta({ name: 'alpha', colour: '#111111' });
            await db.putTagMeta({ name: 'beta', colour: '#222222' });

            expect(await db.getTagMeta('alpha')).toEqual({ name: 'alpha', colour: '#111111' });
            expect(lastWrittenJson(FILES.tagMeta)).toEqual([
                { name: 'alpha', colour: '#111111' },
                { name: 'beta', colour: '#222222' },
            ]);
            expect(SyncToken.touch).toHaveBeenCalledTimes(2);
        });

        it('deleteTagMeta removes the row and rewrites tag_meta.json without it', async () => {
            await db.putTagMeta({ name: 'alpha', colour: '#111111' });
            await db.putTagMeta({ name: 'beta', colour: '#222222' });
            vi.clearAllMocks();

            await db.deleteTagMeta('alpha');

            expect(await db.getTagMeta('alpha')).toBeUndefined();
            expect(lastWrittenJson(FILES.tagMeta)).toEqual([{ name: 'beta', colour: '#222222' }]);
            expect(SyncToken.touch).toHaveBeenCalledTimes(1);
        });

        it('mirror files are empty arrays once every row is removed', async () => {
            await db.putOrder('alpha', ['a.md']);
            await db.putTagMeta({ name: 'alpha', colour: '#111111' });
            await db.deleteTagMeta('alpha');

            expect(lastWrittenJson(FILES.tagMeta)).toEqual([]);
        });
    });

    describe('fromSync writes', () => {
        it('put stores the page without touching the sync token or writing a file', async () => {
            await db.fromSync.put({ filename: 'a.md', tags: ['x'] });

            expect(await db.get('a.md')).toEqual({ filename: 'a.md', tags: ['x'] });
            expect(SyncToken.touch).not.toHaveBeenCalled();
            expect(filestore.saveFile).not.toHaveBeenCalled();
        });

        it('delete removes the page without touching the sync token or writing a file', async () => {
            await db.put({ filename: 'a.md' });
            vi.clearAllMocks();

            await db.fromSync.delete('a.md');

            expect(await db.get('a.md')).toBeUndefined();
            expect(SyncToken.touch).not.toHaveBeenCalled();
            expect(filestore.saveFile).not.toHaveBeenCalled();
        });

        it('putOrder stores the ordering without touching the sync token or writing a file', async () => {
            await db.fromSync.putOrder('alpha', ['a.md']);

            expect(await db.getOrder('alpha')).toEqual(['a.md']);
            expect(SyncToken.touch).not.toHaveBeenCalled();
            expect(filestore.saveFile).not.toHaveBeenCalled();
        });

        it('putTagMeta stores the row without touching the sync token or writing a file', async () => {
            await db.fromSync.putTagMeta({ name: 'alpha', colour: '#111111' });

            expect(await db.getTagMeta('alpha')).toEqual({ name: 'alpha', colour: '#111111' });
            expect(SyncToken.touch).not.toHaveBeenCalled();
            expect(filestore.saveFile).not.toHaveBeenCalled();
        });
    });

    describe('mirror file shapes', () => {
        it('orderings.json written by a local edit can be read back by the sync path', async () => {
            await db.putOrder('alpha', ['a.md', 'b.md']);
            await db.putOrder('beta', ['c.md']);
            const written = lastWrittenJson(FILES.orderings);

            await db.clearAll();
            for (const entry of written) {
                await db.fromSync.putOrder(entry.tag, entry.filenames);
            }

            expect(await db.getOrder('alpha')).toEqual(['a.md', 'b.md']);
            expect(await db.getOrder('beta')).toEqual(['c.md']);
        });

        it('tag_meta.json written by a local edit can be read back by the sync path', async () => {
            await db.putTagMeta({ name: 'alpha', colour: '#111111' });
            const written = lastWrittenJson(FILES.tagMeta);

            await db.clearAll();
            for (const row of written) {
                await db.fromSync.putTagMeta(row);
            }

            expect(await db.getTagMeta('alpha')).toEqual({ name: 'alpha', colour: '#111111' });
        });
    });
});
