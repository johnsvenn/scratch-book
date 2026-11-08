import filestore from './filestore.js';
import Datetime from './DatetimeFunctions.js';
import { FILES, syncTokenPayload } from '../../shared/protocol.js';

const SyncToken = {
    /**
     * Touch the sync state file with the current localized ISO string
     * to notify external watchers that a local change occurred.
     */
    touch: async () => {
        let datetime = new Datetime();
        try {
            await filestore.saveFile(FILES.syncToken, syncTokenPayload({ timestamp: datetime.getDateTimeString() }));
        } catch (e) {
            console.error('Failed to write sync token', e);
        }
    }
};

export default SyncToken;
