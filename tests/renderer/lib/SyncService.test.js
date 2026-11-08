import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/lib/filestore.js', () => ({
    default: {
        getFile: vi.fn(),
        listFiles: vi.fn(),
    },
}));

vi.mock('../../../src/renderer/lib/db.js', () => ({
    default: {
        clearAll: vi.fn(),
        getPageMetaMap: vi.fn(),
        get: vi.fn(),
        putTagMeta: vi.fn(),
        putOrder: vi.fn(),
        fromSync: {
            putTagMeta: vi.fn(),
            putOrder: vi.fn(),
        },
    },
}));

vi.mock('../../../src/renderer/lib/fileFormatter.js', () => ({
    default: {
        extract: vi.fn(),
    },
}));

vi.mock('../../../src/renderer/lib/PageIndex.js', () => ({
    UnifiedIndex: {
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../../../src/renderer/lib/Pages/PageWriter.js', () => ({
    default: {
        importFromDisk: vi.fn(),
        forget: vi.fn(),
    },
}));

import SyncService from '../../../src/renderer/lib/SyncService.js';
import filestore from '../../../src/renderer/lib/filestore.js';
import db from '../../../src/renderer/lib/db.js';
import fileFormatter from '../../../src/renderer/lib/fileFormatter.js';
import { UnifiedIndex } from '../../../src/renderer/lib/PageIndex.js';
import pageWriter from '../../../src/renderer/lib/Pages/PageWriter.js';

describe('SyncService', () => {
    beforeEach(() => {
        SyncService.teardown();
        vi.clearAllMocks();
        if (window.electronAPI) {
            delete window.electronAPI;
        }
    });

    it('handles legacy soft-delete payloads missing filename', async () => {
        filestore.getFile.mockImplementation(async (path) => {
            if (path === '_sync_state.json') return null;
            if (path === 'tag_meta.json') return null;
            if (path === 'orderings.json') return null;
            if (path === 'legacy-page/index.md') return '{ "isDeleted": true }';
            return null;
        });
        filestore.listFiles.mockResolvedValue(['legacy-page']);
        fileFormatter.extract.mockReturnValue([{ isDeleted: true, modifiedAt: '2026-03-19T00:00:00.000Z' }, '']);
        db.getPageMetaMap.mockResolvedValue(new Map([['legacy-page', { filename: 'legacy-page', modifiedAt: null }]]));
        db.get.mockResolvedValue({ filename: 'legacy-page' });

        await SyncService.performSync();

        expect(pageWriter.forget).toHaveBeenCalledWith('legacy-page');
        expect(UnifiedIndex.delete).toHaveBeenCalledWith(expect.objectContaining({ filename: 'legacy-page', isDeleted: true }));
    });

    it('imports a changed page from disk through the writer, and does not write it back', async () => {
        filestore.getFile.mockImplementation(async (path) => {
            if (path === 'fresh-page/index.md') return 'raw';
            return null;
        });
        filestore.listFiles.mockResolvedValue(['fresh-page']);
        fileFormatter.extract.mockReturnValue([{ filename: 'fresh-page', title: 'T', content: 'C', modifiedAt: '2026-03-19T00:00:00.000Z' }, 'C']);
        db.getPageMetaMap.mockResolvedValue(new Map());

        await SyncService.performSync();

        expect(pageWriter.importFromDisk).toHaveBeenCalledWith(expect.objectContaining({ filename: 'fresh-page', title: 'T' }));
        expect(UnifiedIndex.update).toHaveBeenCalledWith(expect.objectContaining({ filename: 'fresh-page' }));
    });

    it('registers sync listener and tears it down cleanly', () => {
        const unsubscribe = vi.fn();
        const on = vi.fn().mockReturnValue(unsubscribe);
        window.electronAPI = { on };

        SyncService.init();

        expect(on).toHaveBeenCalledWith('sync-state-changed', expect.any(Function));
        expect(SyncService.unsubscribeSyncListener).toBe(unsubscribe);

        SyncService.teardown();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(SyncService.initialized).toBe(false);
        expect(SyncService.unsubscribeSyncListener).toBeNull();
    });

    it('is idempotent when init is called multiple times', () => {
        const on = vi.fn().mockReturnValue(() => {});
        window.electronAPI = { on };

        SyncService.init();
        SyncService.init();

        expect(on).toHaveBeenCalledTimes(1);
    });
});
