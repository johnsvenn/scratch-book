/**
 * The page being edited: its saved copy, the dirty check and saving.
 *
 * Plain JavaScript, no Vue imports. The Vue composable passes in a `reactive`
 * wrapper so the template can read `state`.
 *
 * Rules owned here:
 * - A save takes a snapshot of the page when it is requested, and writes that snapshot.
 * - Saves run one after another, in the order they were requested.
 * - saveCurrent only writes when the page differs from its saved copy. Tags are
 *   compared by value. modifiedAt and isSaving are ignored.
 * - Changing a field never saves by itself. Callers choose when to save.
 *
 * Not owned here: navigation, the page index and the list. Those go in `onSaved`.
 *
 * @param {object} options
 * @param {{ save: (page: object) => Promise<object> }} options.writer the page writer
 * @param {(updated: object, info: { isCurrent: boolean }) => (void|Promise<void>)} [options.onSaved]
 *        called after each save, so the caller can update its index and list
 * @param {number} [options.debounceMs=2000] delay used by scheduleSave
 * @param {{ setTimeout: Function, clearTimeout: Function }} [options.timers] injectable for tests
 * @param {(obj: object) => object} [options.reactive] wraps the state, e.g. Vue's reactive
 */
export function createEditorSession({
    writer,
    onSaved = () => {},
    debounceMs = 2000,
    timers = {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
    },
    reactive = (obj) => obj,
}) {
    const state = reactive({ page: null, isSaving: false });
    let savedPage = null;
    let queue = Promise.resolve();
    let debounceTimer = null;

    function copy(obj) {
        return obj ? Object.assign({}, obj) : null;
    }

    function valuesEqual(a, b) {
        if (Array.isArray(a) && Array.isArray(b)) {
            return a.length === b.length && a.every((value, index) => value === b[index]);
        }
        return a === b;
    }

    function hasChanged(item, base) {
        if (!base) {
            return true;
        }
        return Object.keys(item).some((key) => {
            if (key === 'modifiedAt' || key === 'isSaving') {
                return false;
            }
            return !valuesEqual(item[key], base[key]);
        });
    }

    function isCurrentPage(item) {
        return !!state.page && state.page.filename === item.filename;
    }

    function enqueue(task) {
        queue = queue.catch(() => {}).then(task);
        return queue;
    }

    // Dirty-checked save of a snapshot, against the saved snapshot taken when it was requested.
    function queueDirtySave(snapshot, baseSnapshot) {
        return enqueue(async () => {
            if (!hasChanged(snapshot, baseSnapshot)) {
                return;
            }

            const wasCurrent = isCurrentPage(snapshot);
            if (wasCurrent) {
                state.isSaving = true;
            }
            try {
                const updated = await writer.save(snapshot);

                // Check again: the user may have switched page while the save ran.
                const isCurrent = isCurrentPage(snapshot);
                if (isCurrent) {
                    state.page.modifiedAt = updated.modifiedAt;
                }
                await onSaved(updated, { isCurrent });
                if (isCurrent) {
                    savedPage = copy(updated);
                }
            } finally {
                if (wasCurrent) {
                    state.isSaving = false;
                }
            }
        });
    }

    /**
     * Save the current page if it differs from its saved copy.
     * @returns {Promise<void>}
     */
    function saveCurrent() {
        if (!state.page) {
            return Promise.resolve();
        }
        return queueDirtySave(copy(state.page), copy(savedPage));
    }

    return {
        /** Reactive: `page` is the current page and `isSaving` is true while it is being written. */
        state,

        /**
         * Make `page` the current page and take a saved copy of it.
         * The page being left is saved first, if it has changed.
         * @returns {Promise<void>} resolves when that background save has finished
         */
        load(page) {
            const leaving = state.page
                ? queueDirtySave(copy(state.page), copy(savedPage))
                : Promise.resolve();
            state.page = page;
            savedPage = copy(page);
            return leaving;
        },

        /**
         * Drop the current page without saving it. Use this for a page that was just deleted,
         * so its unsaved changes are not written back.
         */
        discard() {
            state.page = null;
            savedPage = null;
        },

        /**
         * Change one field on the current page. Does not save.
         * Arrays must be replaced, not mutated, though the dirty check would catch either.
         */
        setField(name, value) {
            if (!state.page) {
                return;
            }
            state.page[name] = value;
        },

        /** Save the current page after the debounce delay. Each call restarts the delay. */
        scheduleSave() {
            if (debounceTimer !== null) {
                timers.clearTimeout(debounceTimer);
            }
            debounceTimer = timers.setTimeout(() => {
                debounceTimer = null;
                saveCurrent();
            }, debounceMs);
        },

        saveCurrent,

        /**
         * Save a page that is not the current page. Always writes.
         * @param {object} item
         * @returns {Promise<void>}
         */
        saveOther(item) {
            const snapshot = copy(item);
            return enqueue(async () => {
                const updated = await writer.save(snapshot);
                await onSaved(updated, { isCurrent: false });
            });
        },
    };
}
