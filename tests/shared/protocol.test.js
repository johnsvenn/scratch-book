import {
    IPC,
    EVENTS,
    FILES,
    SETTINGS,
    SETTING_DEFAULTS,
    readSettings,
    writeSetting,
    syncTokenPayload,
    isImportToken,
    tombstonePayload,
    isTombstone,
} from '../../src/shared/protocol.js';

describe('settings.json', () => {
    it('returns the defaults when the file is missing', () => {
        expect(readSettings(null)).toEqual(SETTING_DEFAULTS);
        expect(readSettings(undefined)).toEqual(SETTING_DEFAULTS);
    });

    it('returns the defaults when the file is not valid JSON or not an array', () => {
        expect(readSettings('{not json')).toEqual(SETTING_DEFAULTS);
        expect(readSettings('{"enableWatcher": false}')).toEqual(SETTING_DEFAULTS);
    });

    it('reads values from { key, value } entries and fills in missing keys with defaults', () => {
        const text = JSON.stringify([{ key: 'enableWatcher', value: false }, { key: 'other', value: 1 }]);
        expect(readSettings(text)).toEqual({ enableWatcher: false, other: 1 });
    });

    it('ignores malformed entries', () => {
        const text = JSON.stringify([null, { value: true }, { key: 'enableWatcher', value: false }]);
        expect(readSettings(text)[SETTINGS.enableWatcher]).toBe(false);
    });

    it('writes a setting and keeps the other entries in place', () => {
        const text = JSON.stringify([{ key: 'a', value: 1 }, { key: 'enableWatcher', value: true }, { key: 'b', value: 2 }]);
        const written = JSON.parse(writeSetting(text, 'enableWatcher', false));
        expect(written).toEqual([{ key: 'a', value: 1 }, { key: 'enableWatcher', value: false }, { key: 'b', value: 2 }]);
    });

    it('appends a setting that is not in the file yet', () => {
        const written = JSON.parse(writeSetting(null, 'enableWatcher', false));
        expect(written).toEqual([{ key: 'enableWatcher', value: false }]);
    });

    it('round-trips: what is written is what is read back', () => {
        const text = writeSetting(null, SETTINGS.enableWatcher, false);
        expect(readSettings(text)[SETTINGS.enableWatcher]).toBe(false);
    });
});

describe('sync token', () => {
    it('writes the timestamp only for an ordinary change', () => {
        expect(JSON.parse(syncTokenPayload({ timestamp: 'T1' }))).toEqual({ lastSyncTimestamp: 'T1' });
    });

    it('adds import: true for a full import', () => {
        expect(JSON.parse(syncTokenPayload({ timestamp: 'T1', import: true }))).toEqual({ lastSyncTimestamp: 'T1', import: true });
    });

    it('reads import tokens and treats anything else as not an import', () => {
        expect(isImportToken(syncTokenPayload({ timestamp: 'T1', import: true }))).toBe(true);
        expect(isImportToken(syncTokenPayload({ timestamp: 'T1' }))).toBe(false);
        expect(isImportToken(null)).toBe(false);
        expect(isImportToken('{bad')).toBe(false);
    });
});

describe('tombstones', () => {
    it('writes a deletion marker with the filename and modifiedAt', () => {
        expect(tombstonePayload({ filename: 'p1', modifiedAt: 'T2' })).toEqual({
            filename: 'p1',
            isDeleted: true,
            modifiedAt: 'T2',
        });
    });

    it('recognises tombstones, including legacy ones with only isDeleted', () => {
        expect(isTombstone(tombstonePayload({ filename: 'p1', modifiedAt: 'T2' }))).toBe(true);
        expect(isTombstone({ isDeleted: true })).toBe(true);
        expect(isTombstone({ filename: 'p1' })).toBe(false);
        expect(isTombstone(null)).toBe(false);
    });
});

describe('constants', () => {
    it('names the files and channels the two sides share', () => {
        expect(FILES.syncToken).toBe('_sync_state.json');
        expect(FILES.settings).toBe('settings.json');
        expect(FILES.orderings).toBe('orderings.json');
        expect(FILES.tagMeta).toBe('tag_meta.json');
        expect(IPC.syncStateChanged).toBe('sync-state-changed');
        expect(IPC.insertLink).toBe('insert-link');
        expect(IPC.setWatcherEnabled).toBe('set-watcher-enabled');
    });

    it('lists only the events main sends, so the preload cannot listen to anything else', () => {
        expect([...EVENTS].sort()).toEqual([IPC.insertLink, IPC.syncStateChanged].sort());
        expect(EVENTS.has(IPC.saveFile)).toBe(false);
    });
});
