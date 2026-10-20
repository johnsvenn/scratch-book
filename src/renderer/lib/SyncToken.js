import filestore from './filestore.js';
import Datetime from './DatetimeFunctions.js';

const SYNC_TOKEN_FILE = '_sync_state.json';

const SyncToken = {
    /**
     * Touch the sync state file with the current localized ISO string
     * to notify external watchers that a local change occurred.
     */
    touch: async () => {
        let datetime = new Datetime();
        const payload = {
            lastSyncTimestamp: datetime.getDateTimeString(),
        };
        try {
            await filestore.saveFile(SYNC_TOKEN_FILE, JSON.stringify(payload, null, 2));
        } catch (e) {
            console.error('Failed to write sync token', e);
        }
    }
};

export default SyncToken;
export { SYNC_TOKEN_FILE };
