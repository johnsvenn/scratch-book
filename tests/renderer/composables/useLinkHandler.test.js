import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLinkHandler } from '../../../src/renderer/composables/useLinkHandler';
import db from '../../../src/renderer/lib/db';

vi.mock('../../../src/renderer/lib/db', () => ({
    default: { getBySlug: vi.fn() },
}));

// Let the async page:// lookup settle before asserting
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal anchor element (or a child element nested inside one)
 * and attach it to a temporary container in the document body so that
 * closest('a') traversal works correctly.
 */
function makeAnchor(href, { childTag } = {}) {
    const container = document.createElement('div');
    const a = document.createElement('a');
    a.setAttribute('href', href);

    if (childTag) {
        const child = document.createElement(childTag);
        child.textContent = 'link text';
        a.appendChild(child);
        container.appendChild(a);
        document.body.appendChild(container);
        return { target: child, container };
    }

    container.appendChild(a);
    document.body.appendChild(container);
    return { target: a, container };
}

/**
 * Create a synthetic MouseEvent whose target is `element`.
 * jsdom does not support `new MouseEvent` with a writable target, so we
 * attach the listener to `document` and dispatch via the real element.
 */
function clickOn(element) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLinkHandler', () => {
    let openExternal;
    let onPageLink;
    let showToast;
    let handleLinkClick;

    beforeEach(() => {
        openExternal = vi.fn().mockResolvedValue(true);
        onPageLink = vi.fn();
        showToast = vi.fn();
        ({ handleLinkClick } = useLinkHandler({ openExternal, onPageLink, showToast }));

        // Attach handler to document as App.vue would in onMounted
        document.addEventListener('click', handleLinkClick);
    });

    afterEach(() => {
        document.removeEventListener('click', handleLinkClick);
        // Clean up any DOM nodes added during the test
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // External links
    // -----------------------------------------------------------------------

    it('calls openExternal for https:// links and prevents default', () => {
        const { target } = makeAnchor('https://example.com');
        const event = clickOn(target);

        expect(openExternal).toHaveBeenCalledWith('https://example.com');
        expect(event.defaultPrevented).toBe(true);
        expect(onPageLink).not.toHaveBeenCalled();
    });

    it('calls openExternal for http:// links and prevents default', () => {
        const { target } = makeAnchor('http://example.com');
        const event = clickOn(target);

        expect(openExternal).toHaveBeenCalledWith('http://example.com');
        expect(event.defaultPrevented).toBe(true);
    });

    it('resolves clicks on child elements inside an external link via closest()', () => {
        const { target } = makeAnchor('https://example.com', { childTag: 'strong' });
        clickOn(target);

        expect(openExternal).toHaveBeenCalledWith('https://example.com');
    });

    // -----------------------------------------------------------------------
    // Internal app links
    // -----------------------------------------------------------------------

    it('looks up page:// slugs and calls onPageLink with the filename', async () => {
        db.getBySlug.mockResolvedValue({ filename: 'my-page.md', slug: 'settings' });
        const { target } = makeAnchor('page://settings');
        const event = clickOn(target);
        await flush();

        expect(db.getBySlug).toHaveBeenCalledWith('settings');
        expect(onPageLink).toHaveBeenCalledWith('my-page.md');
        expect(event.defaultPrevented).toBe(true);
        expect(openExternal).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
    });

    it('shows a toast when no page has the page:// slug', async () => {
        db.getBySlug.mockResolvedValue(undefined);
        const { target } = makeAnchor('page://nonexistent');
        const event = clickOn(target);
        await flush();

        expect(event.defaultPrevented).toBe(true);
        expect(onPageLink).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('Page "nonexistent" not found.');
    });

    it('resolves clicks on child elements inside an internal link via closest()', async () => {
        db.getBySlug.mockResolvedValue({ filename: 'home.md', slug: 'home' });
        const { target } = makeAnchor('page://home', { childTag: 'em' });
        clickOn(target);
        await flush();

        expect(db.getBySlug).toHaveBeenCalledWith('home');
        expect(onPageLink).toHaveBeenCalledWith('home.md');
    });

    // -----------------------------------------------------------------------
    // Unhandled links — no interception
    // -----------------------------------------------------------------------

    it('does not intercept plain hash anchors', () => {
        const { target } = makeAnchor('#top');
        const event = clickOn(target);

        expect(openExternal).not.toHaveBeenCalled();
        expect(db.getBySlug).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('does not intercept relative hrefs', () => {
        const { target } = makeAnchor('some/relative/path');
        const event = clickOn(target);

        expect(openExternal).not.toHaveBeenCalled();
        expect(db.getBySlug).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Non-anchor clicks
    // -----------------------------------------------------------------------

    it('is a no-op when the click target is not inside an anchor', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        const event = clickOn(div);

        expect(openExternal).not.toHaveBeenCalled();
        expect(db.getBySlug).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });
});
