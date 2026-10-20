import Constants from './constants';
import filestore from './filestore';
import db from './db';

const storeFactory = (storeType) => {
    switch (storeType) {
        case Constants.FILESTORE.FILE_SYSTEM:
            return filestore;
        case Constants.FILESTORE.INDEXDB:
            // Lightweight adapter retained for legacy/migration workflows.
            return {
                saveFile: async (_filename, data) => {
                    // PageService persists structured pages to IDB; this is only a compatibility shim.
                    if (data && typeof data === 'object' && data.filename) {
                        await db.put(data);
                    }
                },
                getFile: async (filename) => db.get(filename),
                listFiles: async () => db.getAll(),
                deleteFile: async (filename) => db.delete(filename),
            };
        default:
    }
};

export default storeFactory;
