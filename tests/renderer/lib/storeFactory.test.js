import storeFactory from '../../../src/renderer/lib/storeFactory';
import Constants from '../../../src/renderer/lib/constants';
import filestore from '../../../src/renderer/lib/filestore';

vi.mock('../../../src/renderer/lib/filestore', () => ({
    default: {
        isMock: true
    }
}));

describe('storeFactory', () => {
    it('returns filestore when type is FILE_SYSTEM', () => {
        const store = storeFactory(Constants.FILESTORE.FILE_SYSTEM);
        expect(store).toBe(filestore);
    });

    it('returns undefined for unknown store types', () => {
        const store = storeFactory('UNKNOWN_TYPE');
        expect(store).toBeUndefined();
    });
});
