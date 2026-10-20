import storeFactory from '../../../src/renderer/lib/storeFactory';
import Constants from '../../../src/renderer/lib/constants';
import filestore from '../../../src/renderer/lib/filestore';
import db from '../../../src/renderer/lib/db';

vi.mock('../../../src/renderer/lib/filestore', () => ({
    default: {
        isMock: true
    }
}));

vi.mock('../../../src/renderer/lib/db', () => ({
    default: {
        put: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        delete: vi.fn(),
    },
}));

describe('storeFactory', () => {
    it('returns filestore when type is FILE_SYSTEM', () => {
        const store = storeFactory(Constants.FILESTORE.FILE_SYSTEM);
        expect(store).toBe(filestore);
    });

    it('returns db adapter object when type is INDEXDB', async () => {
        const store = storeFactory(Constants.FILESTORE.INDEXDB);
        
        expect(store).toHaveProperty('saveFile');
        expect(store).toHaveProperty('getFile');
        expect(store).toHaveProperty('listFiles');
        expect(store).toHaveProperty('deleteFile');

        await store.saveFile('test.md', { filename: 'test.md', title: 'Title' });
        expect(db.put).toHaveBeenCalledWith({ filename: 'test.md', title: 'Title' });

        db.get.mockResolvedValue('DB Content');
        const getRes = await store.getFile('test.md');
        expect(getRes).toBe('DB Content');
        expect(db.get).toHaveBeenCalledWith('test.md');

        db.getAll.mockResolvedValue(['file1', 'file2']);
        const listRes = await store.listFiles();
        expect(listRes).toEqual(['file1', 'file2']);
        expect(db.getAll).toHaveBeenCalled();

        await store.deleteFile('test.md');
        expect(db.delete).toHaveBeenCalledWith('test.md');
    });

    it('returns undefined for unknown store types', () => {
        const store = storeFactory('UNKNOWN_TYPE');
        expect(store).toBeUndefined();
    });
});
