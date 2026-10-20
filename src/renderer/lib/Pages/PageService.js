import Constants from '../constants';
import Datetime from '../DatetimeFunctions';
import Page from './Page';
import storeFactory from '../storeFactory';
import fileFormatter from '../fileFormatter';
import db from '../db';
import SyncToken from '../SyncToken';

const filestore = storeFactory(Constants.FILESTORE.FILE_SYSTEM);

const PageService = {
    /**
     * {?Item}
     */
    currentPage: null,

    /**
     * Persist the item to disc.
     *
     * @param {Page} item
     * @private
     */
    async _persistItem(item) {
        if (!item.filename) return;

        // Requirement: A new page should not be added to indexeddb or the filesystem
        // unless either the title or content are not empty.
        // If it was already there and is now empty, we should delete it.
        if (item.isEmpty()) {
            // Requirement: A new page should not be added to indexeddb or the filesystem
            // unless either the title or content are not empty.
            // If it was already there and is now empty, we should delete it (soft delete).
            const existing = await db.get(item.filename);
            if (!existing) {
                return;
            }

            console.log('Soft deleting empty page', item.filename);
            let datetime = new Datetime();
            const deletedPayload = {
                filename: item.filename,
                isDeleted: true,
                modifiedAt: datetime.getDateTimeString()
            };
            await filestore.saveFile(`${item.filename}/index.md`, JSON.stringify(deletedPayload, null, 2));
            await db.delete(item.filename);
            await SyncToken.touch();
            return;
        }

        let str = fileFormatter.prepareItem(item);
        // Write to a page bundle: folder/index.md
        await filestore.saveFile(`${item.filename}/index.md`, str);

        // Also save to IndexedDB to ensure they stay in sync
        await db.put(item);
        // SyncToken is touched inside db.put(), so no need to call it twice here.
    },

    /**
     * @returns {Page}
     */
    async createItem() {
        return this.newItem();
    },

    newItem() {
        return new Page();
    },

    /**
     *
     * @param {Page} item
     * @returns {Page}
     */
    async updateItem(item) {
        // Returns a new item with all the properties in case the structure has changed?
        item = new Page(item);
        let datetime = new Datetime();
        item.modifiedAt = datetime.getDateTimeString();
        await this._persistItem(item);
        return item;
    },

    /**
     * @param {string} filename (slug)
     * @returns []
     */
    async getItemByFileName(filename) {
        if (!filename) {
            return [this.createItem(), ''];
        }
        // Try getting the new page bundle format first
        let file = await filestore.getFile(`${filename}/index.md`);

        // Fallback for old flat files in case migration is partial
        if (!file) {
            file = await filestore.getFile(`${filename}.txt`);
        }

        let [json, data] = fileFormatter.extract(file);
        if (!json && !data) {
            json = this.createItem();
            data = '';
        } else if (!json) {
            // Upgrade from old format without json
            json = new Page({
                filename: filename,
                createdAt: filename.replace('.txt', ''),
            });
        }
        return [json, data];
    },
};

export default PageService;
