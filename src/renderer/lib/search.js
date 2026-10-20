import MiniSearch from 'minisearch';

const search = {
    _minisearch: new MiniSearch({
        fields: ['title', 'content', 'tags'], // fields to index for full-text search
        storeFields: ['filename', 'title', 'tags', 'modifiedAt', 'content'], // fields to return with search results
        idField: 'filename', // Use filename (slug) as the unique ID
        searchOptions: {
            boost: { title: 2, tags: 1.5 },
            prefix: true, // Allow prefix matching for partial words
            fuzzy: 0.2, // Allow typos
        },
    }),

    init: async (pages) => {
        search._minisearch.removeAll();
        if (pages && pages.length > 0) {
            search._minisearch.addAll(pages);
        }
    },

    add: (page) => {
        if (search._minisearch.has(page.filename)) {
            search._minisearch.replace(page);
        } else {
            search._minisearch.add(page);
        }
    },

    remove: (filename) => {
        try {
            if (typeof search._minisearch.discard === 'function') {
                search._minisearch.discard(filename);
            } else {
                search._minisearch.remove({ filename });
            }
        } catch {
            // Minisearch throws if it doesn't exist, which is fine
        }
    },

    search: (query) => {
        return search._minisearch.search(query);
    },
};

export default search;
