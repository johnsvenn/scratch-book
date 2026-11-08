import Constants from './constants';
import filestore from './filestore';

const storeFactory = (storeType) => {
    switch (storeType) {
        case Constants.FILESTORE.FILE_SYSTEM:
            return filestore;
        default:
    }
};

export default storeFactory;
