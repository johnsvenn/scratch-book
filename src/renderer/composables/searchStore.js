/**
 * Module-level singleton that persists search state across SearchModal
 * open/close cycles without requiring a Vuex/Pinia store.
 *
 * Kept in its own file so tests can import and reset the state directly.
 */
export const searchStore = {
    query:      '',
    results:    [],
    hasSearched: false,
};
