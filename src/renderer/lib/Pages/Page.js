import Datetime from '../DatetimeFunctions.js';
import Constants from '../constants.js';

const Page = function (pageData) {
    /**
     * The actual data we want to save.
     *
     * @type {String}
     */
    this.content = '';

    /**
     * @type {String}
     */
    this.filename = null;

    /**
     * @type {boolean}
     */
    this.isMarkdown = false;

    /**
     * @type {boolean}
     */
    this.isArchived = false;

    /**
     * @type {boolean}
     */
    this.isFavourite = false;

    /**
     * @type {boolean}
     */
    this.spellcheckEnabled = false;

    /**
     * @type {?String}
     */
    this.title = null;

    /**
     * @type {[?String]}
     */
    this.tags = [Constants.CURRENT_TAG];

    /**
     * @type {?String}
     */
    this.summary = null;

    /**
     * URL-safe identifier for page:// links. Null until explicitly set.
     * Must be unique across all pages (including archived).
     * @type {?String}
     */
    this.slug = null;

    /**
     * @type {}
     */
    this.createdAt = null;

    /**
     * @type {null}
     */
    this.modifiedAt = null;

    if (pageData) {
        Object.assign(this, pageData);
    }

    // To satisfy IndexedDB, every page must have a filename (slug/id).
    if (!this.filename) {
        let datetime = new Datetime();
        this.filename = datetime.getDateTimeString(); // No longer appending .txt
        this.createdAt = datetime.getDateTimeString();
    }
};

/**
 * Returns true if the page has no title or content, or only whitespace.
 * @returns {boolean}
 */
Page.prototype.isEmpty = function () {
    return (!this.title || !this.title.trim()) && (!this.content || !this.content.trim());
};

export default Page;
