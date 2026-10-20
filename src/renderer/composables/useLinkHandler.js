/**
 * useLinkHandler — delegated click handler for marked.js rendered HTML.
 *
 * Registers a single listener on `document` (via App.vue lifecycle hooks) that
 * intercepts anchor clicks and dispatches them to the correct handler based on
 * the link's href prefix.
 *
 * ## Link conventions for markdown authors
 *
 * | Link type       | href format           | Example                          |
 * |-----------------|-----------------------|----------------------------------|
 * | External web    | `http://` / `https://`| `[Docs](https://example.com)`    |
 * | Internal page   | `page://<slug>`       | `[Settings](page://settings)`    |
 * | Plain anchor    | `#section`            | `[Top](#top)` — not intercepted  |
 *
 * Internal links use the `page://` scheme. The remainder is treated as a page
 * slug and looked up in the database. If found, `onPageLink` receives the
 * page's filename; otherwise `showToast` reports that the page was not found.
 *
 * @param {{
 *   openExternal?: (url: string) => Promise<boolean>,
 *   onPageLink?: (filename: string) => void,
 *   showToast?: (message: string) => void,
 * }} [options]
 *   - openExternal: async function that forwards the URL to the main process
 *     via IPC. Defaults to `window.electronAPI.openExternal`. Supply a mock
 *     in tests.
 *   - onPageLink: called with the target page's filename when a `page://` link
 *     resolves to a page.
 *   - showToast: called with a message when a `page://` link cannot be resolved.
 */
import db from '../lib/db';

export function useLinkHandler({ openExternal, onPageLink, showToast } = {}) {
    const _openExternal = openExternal ?? ((url) => window.electronAPI.openExternal(url));

    /**
     * Click handler — attach to `document` via addEventListener.
     * Uses `closest('a')` so clicks on child elements inside a link
     * (e.g. `<a><strong>text</strong></a>`) are correctly resolved.
     *
     * @param {MouseEvent} event
     */
    async function handleLinkClick(event) {
        const anchor = event.target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href') ?? '';

        // 1. External links — open in the OS default browser via main process
        if (href.startsWith('http://') || href.startsWith('https://')) {
            event.preventDefault();
            _openExternal(href);
            return;
        }

        // 2. Internal page links — page://slug → look up the page by its slug
        if (href.startsWith('page://')) {
            event.preventDefault();
            const slug = href.slice('page://'.length);
            const page = await db.getBySlug(slug);
            if (page) {
                onPageLink?.(page.filename);
            } else {
                showToast?.(`Page "${slug}" not found.`);
            }
            return;
        }

        // 3. All other hrefs (plain anchors, etc.) — no special handling
    }

    return { handleLinkClick };
}
