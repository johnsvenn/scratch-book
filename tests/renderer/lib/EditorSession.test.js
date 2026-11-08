import { describe, it, expect, vi } from 'vitest';
import { createEditorSession } from '../../../src/renderer/lib/EditorSession.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Immediate writer: resolves right away and returns the page with a new modifiedAt.
function makeWriter() {
    return {
        save: vi.fn(async (page) => ({ ...page, modifiedAt: 'saved' })),
    };
}

// Gated writer: each save waits until the test releases it, so ordering can be checked.
function makeGatedWriter() {
    const started = [];
    const gates = [];
    const writer = {
        save: vi.fn((page) => {
            started.push(page.title);
            return new Promise((resolve) => {
                gates.push(() => resolve({ ...page, modifiedAt: 'saved' }));
            });
        }),
    };
    async function releaseNext() {
        while (gates.length === 0) await tick();
        gates.shift()();
        await tick();
    }
    return { writer, started, releaseNext };
}

// Fake timers: nothing fires until the test calls fireAll().
function makeTimers() {
    const pending = new Map();
    const delays = [];
    let nextId = 1;
    return {
        delays,
        pendingCount: () => pending.size,
        setTimeout: (fn, ms) => {
            const id = nextId++;
            pending.set(id, fn);
            delays.push(ms);
            return id;
        },
        clearTimeout: (id) => {
            pending.delete(id);
        },
        fireAll() {
            const all = [...pending.values()];
            pending.clear();
            all.forEach((fn) => fn());
        },
    };
}

const samplePage = (overrides = {}) => ({
    filename: 'a.json',
    title: 'A',
    content: 'Hello',
    tags: ['Pets'],
    isMarkdown: false,
    modifiedAt: 'original',
    ...overrides,
});

function makeSession(options = {}) {
    const writer = options.writer ?? makeWriter();
    const timers = makeTimers();
    const onSaved = vi.fn(async () => {});
    const session = createEditorSession({ writer, onSaved, timers, ...options.extra });
    return { session, writer, timers, onSaved };
}

describe('createEditorSession', () => {
    describe('load and setField', () => {
        it('makes the loaded page the current page', () => {
            const { session } = makeSession();

            session.load(samplePage());

            expect(session.state.page.title).toBe('A');
        });

        it('setField changes one field on the current page', () => {
            const { session } = makeSession();
            session.load(samplePage());

            session.setField('title', 'B');

            expect(session.state.page.title).toBe('B');
        });

        it('setField does not save by itself', () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            session.setField('title', 'B');

            expect(writer.save).not.toHaveBeenCalled();
        });
    });

    describe('saveCurrent', () => {
        it('writes the page when a field has changed', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());
            session.setField('title', 'B');

            await session.saveCurrent();

            expect(writer.save).toHaveBeenCalledTimes(1);
            expect(writer.save.mock.calls[0][0].title).toBe('B');
        });

        it('does nothing when nothing has changed', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            await session.saveCurrent();

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('saves when tags are replaced with a new array that has an extra tag', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            session.setField('tags', [...session.state.page.tags, 'Work']);
            await session.saveCurrent();

            expect(writer.save).toHaveBeenCalledTimes(1);
            expect(writer.save.mock.calls[0][0].tags).toEqual(['Pets', 'Work']);
        });

        it('compares tags by value, so an equal new array is not a change', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            session.setField('tags', ['Pets']);
            await session.saveCurrent();

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('ignores modifiedAt when deciding whether the page changed', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            session.setField('modifiedAt', 'something-else');
            await session.saveCurrent();

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('sets modifiedAt on the page and the saved copy, so an unchanged page is not saved again', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());
            session.setField('title', 'B');

            await session.saveCurrent();
            expect(session.state.page.modifiedAt).toBe('saved');

            await session.saveCurrent();
            expect(writer.save).toHaveBeenCalledTimes(1);
        });

        it('calls onSaved with the saved page and isCurrent true', async () => {
            const { session, onSaved } = makeSession();
            session.load(samplePage());
            session.setField('title', 'B');

            await session.saveCurrent();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'B' }), { isCurrent: true });
        });

        it('does nothing when no page is loaded', async () => {
            const { session, writer } = makeSession();

            await session.saveCurrent();

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('saves the page as it was when requested, not with edits made while the save waited', async () => {
            const gated = makeGatedWriter();
            const { session } = makeSession({ writer: gated.writer });
            session.load(samplePage());
            session.setField('title', 'B');

            const first = session.saveCurrent();
            session.setField('title', 'C');
            await gated.releaseNext();
            await first;

            expect(gated.started).toEqual(['B']);
            // The later edit is still unsaved, so the next save writes it.
            const second = session.saveCurrent();
            await gated.releaseNext();
            await second;
            expect(gated.started).toEqual(['B', 'C']);
        });

        it('runs saves one after another, in the order they were requested', async () => {
            const gated = makeGatedWriter();
            const { session } = makeSession({ writer: gated.writer });
            session.load(samplePage());

            session.setField('title', 'B');
            const first = session.saveCurrent();
            session.setField('title', 'C');
            const second = session.saveCurrent();

            // Only the first save has started until it is released.
            await tick();
            expect(gated.started).toEqual(['B']);

            await gated.releaseNext();
            await gated.releaseNext();
            await Promise.all([first, second]);

            expect(gated.started).toEqual(['B', 'C']);
        });
    });

    describe('isSaving', () => {
        it('is true while the save runs and false afterwards', async () => {
            const gated = makeGatedWriter();
            const { session } = makeSession({ writer: gated.writer });
            session.load(samplePage());
            session.setField('title', 'B');

            const save = session.saveCurrent();
            await tick();
            expect(session.state.isSaving).toBe(true);

            await gated.releaseNext();
            await save;
            expect(session.state.isSaving).toBe(false);
        });

        it('goes back to false when the save fails, and the error reaches the caller', async () => {
            const writer = { save: vi.fn().mockRejectedValue(new Error('disk full')) };
            const { session } = makeSession({ writer });
            session.load(samplePage());
            session.setField('title', 'B');

            await expect(session.saveCurrent()).rejects.toThrow('disk full');
            expect(session.state.isSaving).toBe(false);
        });
    });

    describe('load saves the page being left', () => {
        it('saves the outgoing page when it has changed', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage({ filename: 'a.json' }));
            session.setField('title', 'edited');

            await session.load(samplePage({ filename: 'b.json', title: 'B' }));

            expect(writer.save).toHaveBeenCalledTimes(1);
            expect(writer.save.mock.calls[0][0].filename).toBe('a.json');
            expect(writer.save.mock.calls[0][0].title).toBe('edited');
        });

        it('does not write the outgoing page when it has not changed', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage({ filename: 'a.json' }));

            await session.load(samplePage({ filename: 'b.json', title: 'B' }));

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('does not save anything when there was no page before', async () => {
            const { session, writer } = makeSession();

            await session.load(samplePage());

            expect(writer.save).not.toHaveBeenCalled();
        });

        it('switches to the new page without changing it when the outgoing save finishes', async () => {
            const { session } = makeSession();
            session.load(samplePage({ filename: 'a.json' }));
            session.setField('title', 'edited');

            const leaving = session.load(samplePage({ filename: 'b.json', title: 'B', modifiedAt: 'b-original' }));
            await leaving;

            expect(session.state.page.filename).toBe('b.json');
            expect(session.state.page.modifiedAt).toBe('b-original');
            expect(session.state.isSaving).toBe(false);
        });
    });

    describe('discard', () => {
        it('drops the current page without saving its unsaved changes', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());
            session.setField('title', 'edited');

            session.discard();
            await session.saveCurrent();

            expect(session.state.page).toBeNull();
            expect(writer.save).not.toHaveBeenCalled();
        });

        it('a page loaded after a discard is not saved on the way out', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage({ filename: 'a.json' }));
            session.setField('title', 'edited');
            session.discard();

            await session.load(samplePage({ filename: 'b.json', title: 'B' }));

            expect(writer.save).not.toHaveBeenCalled();
        });
    });

    describe('saveOther', () => {
        it('always writes the given page, even when it is unchanged', async () => {
            const { session, writer } = makeSession();
            session.load(samplePage());

            await session.saveOther(samplePage({ filename: 'other.json', title: 'O' }));

            expect(writer.save).toHaveBeenCalledTimes(1);
            expect(writer.save.mock.calls[0][0].filename).toBe('other.json');
        });

        it('leaves the current page, its saved copy and isSaving alone', async () => {
            const { session } = makeSession();
            session.load(samplePage());

            await session.saveOther(samplePage({ filename: 'other.json', title: 'O' }));

            expect(session.state.page.filename).toBe('a.json');
            expect(session.state.page.modifiedAt).toBe('original');
            expect(session.state.isSaving).toBe(false);
        });

        it('calls onSaved with isCurrent false', async () => {
            const { session, onSaved } = makeSession();
            session.load(samplePage());

            await session.saveOther(samplePage({ filename: 'other.json', title: 'O' }));

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ filename: 'other.json' }), { isCurrent: false });
        });
    });

    describe('a save for a page that is no longer current', () => {
        it('does not change the new current page', async () => {
            const { session, onSaved } = makeSession();
            session.load(samplePage({ filename: 'a.json' }));
            session.setField('title', 'edited');

            const pending = session.saveCurrent();
            session.load(samplePage({ filename: 'b.json', title: 'B', modifiedAt: 'b-original' }));
            await pending;

            expect(session.state.page.filename).toBe('b.json');
            expect(session.state.page.modifiedAt).toBe('b-original');
            expect(onSaved).toHaveBeenLastCalledWith(expect.objectContaining({ filename: 'a.json' }), { isCurrent: false });
        });
    });

    describe('scheduleSave', () => {
        it('saves the current page once, after the debounce delay, however many times it is called', async () => {
            const { session, writer, timers } = makeSession();
            session.load(samplePage());

            session.setField('title', 'B');
            session.scheduleSave();
            session.setField('title', 'C');
            session.scheduleSave();
            expect(writer.save).not.toHaveBeenCalled();

            timers.fireAll();
            await tick();

            expect(writer.save).toHaveBeenCalledTimes(1);
            expect(writer.save.mock.calls[0][0].title).toBe('C');
            expect(timers.delays).toEqual([2000, 2000]);
        });
    });
});
