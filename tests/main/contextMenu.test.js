import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Shared with the hoisted electron mock below, which runs before any imports
const state = vi.hoisted(() => ({
    contextMenuHandler: null,
    popupMenus: [],
    elementAtPoint: null,
    homeDir: null,
}));

vi.mock('electron', () => {
    class MenuItem {
        constructor(options) {
            Object.assign(this, options);
        }
    }

    class Menu {
        constructor() {
            this.items = [];
        }
        append(item) {
            this.items.push(item);
        }
        popup() {
            state.popupMenus.push(this);
        }
    }

    class BrowserWindow {
        constructor() {
            this.webContents = {
                on: (event, handler) => {
                    if (event === 'context-menu') state.contextMenuHandler = handler;
                },
                send: () => {},
                session: {},
                replaceMisspelling: () => {},
                // Runs the renderer-side script the same way Electron does
                executeJavaScript: (code) => Promise.resolve(new Function(`return ${code}`)()),
            };
        }
        on() {}
        loadFile() {}
        loadURL() {}
        isDestroyed() {
            return false;
        }
        static getAllWindows() {
            return [];
        }
    }

    const app = {
        whenReady: () => Promise.resolve(),
        getPath: () => state.homeDir,
        on: () => {},
    };

    return {
        app,
        BrowserWindow,
        Menu,
        MenuItem,
        ipcMain: { handle: () => {}, on: () => {} },
        dialog: {},
        shell: {},
    };
});

vi.mock('chokidar', () => ({
    default: { watch: () => ({ on: () => {}, close: () => {} }) },
}));

function buildPage() {
    document.body.innerHTML = `
        <div class="page-layout">
            <div class="page-layout__header">
                <input class="page-layout__title-input" type="text" />
            </div>
            <textarea class="page-layout__content-textarea"></textarea>
            <div class="markdown-renderer"><p><span class="rendered-text">Hello</span></p></div>
            <section class="page-layout__foot"><div class="page-layout__created-at">Created</div></section>
        </div>`;

    return {
        title: document.querySelector('.page-layout__title-input'),
        content: document.querySelector('.page-layout__content-textarea'),
        rendered: document.querySelector('.rendered-text'),
        footer: document.querySelector('.page-layout__created-at'),
    };
}

function contextMenuParams(x = 120, y = 45) {
    return {
        x,
        y,
        dictionarySuggestions: [],
        misspelledWord: '',
        editFlags: { canCut: true, canCopy: true, canPaste: true },
        formControlType: 'none',
    };
}

describe('main process context menu', () => {
    beforeAll(async () => {
        state.homeDir = mkdtempSync(join(tmpdir(), 'scratchbook-test-'));
        await import('../../src/main/index.js');
        // Let app.whenReady().then(createWindow) run
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

    afterAll(() => {
        rmSync(state.homeDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        state.popupMenus.length = 0;
        state.elementAtPoint = null;
        document.elementFromPoint = vi.fn(() => state.elementAtPoint);
    });

    it.each([
        ['the title input', 'title'],
        ['the content textarea', 'content'],
        ['rendered markdown', 'rendered'],
    ])('shows over %s', async (_, key) => {
        const elements = buildPage();
        state.elementAtPoint = elements[key];

        await state.contextMenuHandler({}, contextMenuParams());

        expect(state.popupMenus).toHaveLength(1);
    });

    it('does not show over other elements', async () => {
        state.elementAtPoint = buildPage().footer;

        await state.contextMenuHandler({}, contextMenuParams());

        expect(state.popupMenus).toHaveLength(0);
    });

    it('looks up the element at the click position', async () => {
        state.elementAtPoint = buildPage().title;

        await state.contextMenuHandler({}, contextMenuParams(120, 45));

        expect(document.elementFromPoint).toHaveBeenCalledWith(120, 45);
    });

    it('offers cut, copy and paste when shown', async () => {
        state.elementAtPoint = buildPage().content;

        await state.contextMenuHandler({}, contextMenuParams());

        const roles = state.popupMenus[0].items.map((item) => item.role);
        expect(roles).toEqual(['cut', 'copy', 'paste']);
    });
});

describe('context menu selectors match the markup', () => {
    it.each([
        ['src/renderer/components/HomePage.vue', 'class="page-layout__title-input"'],
        ['src/renderer/components/HomePage.vue', 'class="page-layout__content-textarea"'],
        ['src/renderer/components/MarkdownRenderer.vue', 'class="markdown-renderer"'],
    ])('%s contains %s', (file, markup) => {
        const source = readFileSync(join(process.cwd(), file), 'utf8');

        expect(source).toContain(markup);
    });
});
