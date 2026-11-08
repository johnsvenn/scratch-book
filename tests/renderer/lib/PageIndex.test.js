import { UnifiedIndex, defaultIndex, archiveIndex } from '../../../src/renderer/lib/PageIndex.js';
import db from '../../../src/renderer/lib/db.js';
import Page from '../../../src/renderer/lib/Pages/Page.js';
import Constants from '../../../src/renderer/lib/constants.js';
import search from '../../../src/renderer/lib/search.js';

vi.mock('../../../src/renderer/lib/db.js', () => ({
    default: {
        getAll: vi.fn(),
        getOrder: vi.fn(),
        putOrder: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
        clear: vi.fn(),
    }
}));
vi.mock('../../../src/renderer/lib/search.js', () => ({
    default: {
        init: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        search: vi.fn(),
    }
}));

describe('PageIndex Ordering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        UnifiedIndex.items = [];
        UnifiedIndex.initialized = false;
    });

    it('should sort items by createdAt ascending', async () => {
        const pages = [
            { filename: 'newer', createdAt: '2026-03-08T17:00:00.000Z' },
            { filename: 'older', createdAt: '2026-03-08T16:00:00.000Z' },
            { filename: 'middle', createdAt: '2026-03-08T16:30:00.000Z' },
        ];

        db.getAll.mockResolvedValue(pages);

        const items = await UnifiedIndex.read();

        expect(items[0].filename).toBe('older');
        expect(items[1].filename).toBe('middle');
        expect(items[2].filename).toBe('newer');
    });

    it('should sort items by predefined order if getOrder returns an array', async () => {
        db.getAll.mockResolvedValue([
            { filename: 'newer', createdAt: '2026-03-08T17:00:00.000Z' },
            { filename: 'older', createdAt: '2026-03-08T16:00:00.000Z' },
            { filename: 'middle', createdAt: '2026-03-08T16:30:00.000Z' },
        ]);
        db.getOrder.mockResolvedValue(['newer', 'middle', 'older']);

        const items = await UnifiedIndex.read();
        
        expect(items[0].filename).toBe('newer');
        expect(items[1].filename).toBe('middle');
        expect(items[2].filename).toBe('older');
    });

    it('should handle sorting when items are missing from the predefined order', async () => {
        db.getAll.mockResolvedValue([
            { filename: 'missing', createdAt: '2026-03-08T18:00:00.000Z' },
            { filename: 'newer', createdAt: '2026-03-08T17:00:00.000Z' },
        ]);
        db.getOrder.mockResolvedValue(['newer']);

        const items = await UnifiedIndex.read();
        
        expect(items[0].filename).toBe('newer');
        expect(items[1].filename).toBe('missing'); // Sorted to end
    });

    it('init should only call read once', async () => {
        const spyRead = vi.spyOn(UnifiedIndex, 'read').mockResolvedValue([]);
        await UnifiedIndex.init();
        await UnifiedIndex.init(); // Second call shouldn't read
        expect(spyRead).toHaveBeenCalledTimes(1);
        spyRead.mockRestore();
    });

    describe('Core Methods (append, prepend, delete, update, setItems, search)', () => {
        const searchAdd = search.add;
        const searchRemove = search.remove;
        const doSearch = search.search;

        // Page rows are written by PageWriter. The index only changes memory and tag order.

        it('append should add a non-empty item to memory and the current tag order, without writing the page', async () => {
            const item = { filename: 'test', title: 'A', content: 'B', tags: [] };
            db.getOrder.mockResolvedValue(['existing']);
            await UnifiedIndex.append(item);

            expect(UnifiedIndex.items[UnifiedIndex.items.length - 1].filename).toBe('test');
            expect(db.put).not.toHaveBeenCalled();
            expect(searchAdd).not.toHaveBeenCalled();
            expect(db.putOrder).toHaveBeenCalledWith(Constants.CURRENT_TAG, ['existing', 'test']);
        });

        it('prepend should add a non-empty item to memory and the current tag order, without writing the page', async () => {
            const item = { filename: 'test-prep', title: 'A', content: 'B', tags: [] };
            db.getOrder.mockResolvedValue(['existing']);
            await UnifiedIndex.prepend(item);

            expect(UnifiedIndex.items[0].filename).toBe('test-prep');
            expect(db.put).not.toHaveBeenCalled();
            expect(searchAdd).not.toHaveBeenCalled();
            expect(db.putOrder).toHaveBeenCalledWith(Constants.CURRENT_TAG, ['test-prep', 'existing']);
        });

        it('delete should remove item from memory and tag orders, without deleting the page row', async () => {
            UnifiedIndex.items = [new Page({ filename: 'test-del', title: 'A' })];
            db.getOrder.mockResolvedValue(['test-del', 'other']);

            await UnifiedIndex.delete(UnifiedIndex.items[0]);

            expect(UnifiedIndex.items.length).toBe(0);
            expect(db.delete).not.toHaveBeenCalled();
            expect(searchRemove).not.toHaveBeenCalled();
            expect(db.putOrder).toHaveBeenCalledWith(Constants.CURRENT_TAG, ['other']);
            expect(db.putOrder).toHaveBeenCalledWith(Constants.ARCHIVE_TAG, ['other']);
            expect(db.putOrder).toHaveBeenCalledWith(Constants.FAVOURITE_TAG, ['other']);
        });

        it('update should replace existing item or push if not found, in memory only', async () => {
            UnifiedIndex.items = [new Page({ filename: 'test-update', title: 'Old' })];
            await UnifiedIndex.update({ filename: 'test-update', title: 'New', content: 'Not empty' });

            expect(UnifiedIndex.items[0].title).toBe('New');
            expect(db.put).not.toHaveBeenCalled();
            expect(searchAdd).not.toHaveBeenCalled();

            await UnifiedIndex.update({ filename: 'new-item', title: 'Brand new', content: 'C' });
            expect(UnifiedIndex.items[1].filename).toBe('new-item');
        });

        it('update keeps an emptied item in memory, so the list does not shift while the user is on it', async () => {
            UnifiedIndex.items = [new Page({ filename: 'test', title: 'A' })];
            const item = new Page({ filename: 'test', title: '', content: '' });
            await UnifiedIndex.update(item);
            expect(UnifiedIndex.items.map((p) => p.filename)).toEqual(['test']);
            expect(db.delete).not.toHaveBeenCalled();
            expect(searchRemove).not.toHaveBeenCalled();
        });

        it('search should map search wrapper results to items', () => {
            UnifiedIndex.items = [
                new Page({ filename: '1' }),
                new Page({ filename: '2' })
            ];
            doSearch.mockReturnValue([{id: '2', score: 100}]);
            const results = UnifiedIndex.search('query');
            expect(results.length).toBe(1);
            expect(results[0].filename).toBe('2');

            // Empty query returns all items
            const all = UnifiedIndex.search('');
            expect(all.length).toBe(2);
        });

        it('save should do nothing (noop)', async () => {
            await expect(UnifiedIndex.save()).resolves.toBeUndefined();
        });

        it('list should return items array', () => {
            UnifiedIndex.items = [new Page({ filename: '1' })];
            expect(UnifiedIndex.list().length).toBe(1);
        });

        it('append/prepend handle missing db order and archived items', async () => {
            db.getOrder.mockResolvedValue(null);
            const item = { filename: 'new', title: 'T', content: 'C' };
            await UnifiedIndex.append(item);
            expect(db.putOrder).toHaveBeenCalledWith(Constants.CURRENT_TAG, ['new']);

            db.putOrder.mockClear();
            db.getOrder.mockResolvedValue(['new']);
            await UnifiedIndex.prepend(item);
            // It's already in the order, so putOrder shouldn't be called
            expect(db.putOrder).not.toHaveBeenCalled();

            // archived item should not update CURRENT_TAG order
            db.putOrder.mockClear();
            await UnifiedIndex.append({ filename: 'arch', title: 'T', content: 'C', tags: [Constants.ARCHIVE_TAG] });
            expect(db.putOrder).not.toHaveBeenCalled();
        });

        it('delete handles missing items in order array gracefully', async () => {
            UnifiedIndex.items = [new Page({ filename: 'test-del', title: 'A' })];
            db.getOrder.mockResolvedValue(null); // No order array
            
            await UnifiedIndex.delete(UnifiedIndex.items[0]);
            // Shouldn't throw
            expect(UnifiedIndex.items.length).toBe(0);
        });
    });

    describe('Tag Filtering & Ordering', () => {
        it('filterByTag handles missing tags', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: [Constants.CURRENT_TAG] }),
                new Page({ filename: '2', tags: [Constants.ARCHIVE_TAG] }),
            ];
            const filtered = await UnifiedIndex.filterByTag(null);
            expect(filtered.length).toBe(1);
            expect(filtered[0].filename).toBe('1');
        });

        it('filterByTag returns correctly for ARCHIVE_TAG', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: [Constants.CURRENT_TAG] }),
                new Page({ filename: '2', tags: [Constants.ARCHIVE_TAG] }),
            ];
            const filtered = await UnifiedIndex.filterByTag(Constants.ARCHIVE_TAG);
            expect(filtered.length).toBe(1);
            expect(filtered[0].filename).toBe('2');
        });

        it('filterByTag returns custom tag ordered via db.getOrder', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: ['ideas'] }),
                new Page({ filename: '2', tags: ['ideas'] }),
            ];
            db.getOrder.mockResolvedValue(['2', '1']);
            const filtered = await UnifiedIndex.filterByTag('ideas');
            expect(filtered[0].filename).toBe('2');
            expect(filtered[1].filename).toBe('1');
        });

        it('saveTagOrder persists order and updates in-memory array if its CURRENT_TAG', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1' }),
                new Page({ filename: '2' })
            ];
            await UnifiedIndex.saveTagOrder(Constants.CURRENT_TAG, [{filename:'2'}, {filename:'1'}]);
            expect(db.putOrder).toHaveBeenCalledWith(Constants.CURRENT_TAG, ['2', '1']);
            expect(UnifiedIndex.items[0].filename).toBe('2');
        });

        it('saveTagOrder persists order without modifying sort if not CURRENT_TAG', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1' }),
                new Page({ filename: '2' })
            ];
            await UnifiedIndex.saveTagOrder('another-tag', [{filename:'2'}, {filename:'1'}]);
            expect(db.putOrder).toHaveBeenCalledWith('another-tag', ['2', '1']);
            expect(UnifiedIndex.items[0].filename).toBe('1'); // Unchanged sort
        });

        it('filterByTag returns unsorted when no db order is found', async () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: ['ideas'] }),
                new Page({ filename: '2', tags: ['ideas'] }),
            ];
            db.getOrder.mockResolvedValue(null);
            const filtered = await UnifiedIndex.filterByTag('ideas');
            expect(filtered[0].filename).toBe('1');
        });
    });

    describe('Tag Discovery & Facades', () => {
        it('getAllUserTags filters reserved tags and sorts by popularity', () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: [Constants.CURRENT_TAG, 'ideas'] }),
                new Page({ filename: '2', tags: ['ideas', 'work', Constants.FAVOURITE_TAG] }),
                new Page({ filename: '3', tags: ['work', Constants.ARCHIVE_TAG] }),
                new Page({ filename: '4', tags: ['ideas'] }),
                new Page({ filename: '5' }) // no tags branch coverage
            ];

            const tags = UnifiedIndex.getAllUserTags();
            
            // Expected: ideas (3), work (2)
            // Constants.CURRENT_TAG, Constants.ARCHIVE_TAG, Constants.FAVOURITE_TAG should be excluded
            expect(tags).toHaveLength(2);
            expect(tags[0]).toEqual({ name: 'ideas', count: 3 });
            expect(tags[1]).toEqual({ name: 'work', count: 2 });
        });

        it('getTagIndex facade filters correctly', () => {
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: ['ideas'] }),
                new Page({ filename: '2', tags: ['ideas', 'work'] }),
                new Page({ filename: '3', tags: ['ideas', Constants.ARCHIVE_TAG] }), // Should be excluded 
                new Page({ filename: '4', tags: ['work'] }),
            ];

            const ideasIndex = UnifiedIndex.getTagIndex('ideas');
            const list = ideasIndex.list();

            expect(list).toHaveLength(2);
            expect(list.map(p => p.filename)).toEqual(['1', '2']);
            expect(ideasIndex.tagName).toBe('ideas');
            expect(ideasIndex.indexFileName).toBe('tag_ideas.json');
        });

        it('getTagIndex facade maps all methods to UnifiedIndex', async () => {
            const index = UnifiedIndex.getTagIndex('testTag');
            const spyInit = vi.spyOn(UnifiedIndex, 'init').mockResolvedValue();
            const spyAppend = vi.spyOn(UnifiedIndex, 'append').mockResolvedValue();
            const spyDelete = vi.spyOn(UnifiedIndex, 'delete').mockResolvedValue();
            const spyUpdate = vi.spyOn(UnifiedIndex, 'update').mockResolvedValue();
            const spySave = vi.spyOn(UnifiedIndex, 'save').mockResolvedValue();
            const spyFilter = vi.spyOn(UnifiedIndex, 'filterByTag').mockResolvedValue();
            const spyTagOrder = vi.spyOn(UnifiedIndex, 'saveTagOrder').mockResolvedValue();

            await index.init();
            expect(spyInit).toHaveBeenCalled();

            const mockItem = new Page({ filename: 'f' }); // no tags originally
            await index.append(mockItem);
            expect(mockItem.tags).toContain('testTag');
            expect(spyAppend).toHaveBeenCalledWith(mockItem);

            // test appending item that already has the tag (line 214 branch coverage)
            const mockItemWithTag = new Page({ filename: 'f2', tags: ['testTag'] });
            await index.append(mockItemWithTag);
            expect(mockItemWithTag.tags).toEqual(['testTag']); // No duplication

            await index.delete(mockItem);
            expect(spyDelete).toHaveBeenCalledWith(mockItem);

            await index.update(mockItem);
            expect(spyUpdate).toHaveBeenCalledWith(mockItem);

            await index.save();
            expect(spySave).toHaveBeenCalled();

            await index.filter('taggy');
            expect(spyFilter).toHaveBeenCalledWith('taggy');

            await index.saveTagOrder('taggy', []);
            expect(spyTagOrder).toHaveBeenCalledWith('taggy', []);

            spyInit.mockRestore(); spyAppend.mockRestore(); spyDelete.mockRestore();
            spyUpdate.mockRestore(); spySave.mockRestore(); spyFilter.mockRestore(); spyTagOrder.mockRestore();
        });
    });

    describe('defaultIndex Facade', () => {

        it('maps methods to UnifiedIndex', async () => {
            const spyInit = vi.spyOn(UnifiedIndex, 'init').mockResolvedValue();
            const spyRead = vi.spyOn(UnifiedIndex, 'read').mockResolvedValue();
            const spyAppend = vi.spyOn(UnifiedIndex, 'append').mockResolvedValue();
            const spyPrepend = vi.spyOn(UnifiedIndex, 'prepend').mockResolvedValue();
            const spyDelete = vi.spyOn(UnifiedIndex, 'delete').mockResolvedValue();
            const spyUpdate = vi.spyOn(UnifiedIndex, 'update').mockResolvedValue();
            const spyMove = vi.spyOn(UnifiedIndex, 'move').mockReturnValue();
            const spySave = vi.spyOn(UnifiedIndex, 'save').mockResolvedValue();
            const spyFilter = vi.spyOn(UnifiedIndex, 'filterByTag').mockResolvedValue();
            const spyTagOrder = vi.spyOn(UnifiedIndex, 'saveTagOrder').mockResolvedValue();
            const spySearch = vi.spyOn(UnifiedIndex, 'search').mockReturnValue([]);

            await defaultIndex.init(); expect(spyInit).toHaveBeenCalled();
            await defaultIndex.read(); expect(spyRead).toHaveBeenCalled();
            
            const mockItem = new Page({ filename: 'f' });
            await defaultIndex.append(mockItem); expect(spyAppend).toHaveBeenCalledWith(mockItem);
            await defaultIndex.prepend(mockItem); expect(spyPrepend).toHaveBeenCalledWith(mockItem);
            await defaultIndex.delete(mockItem); expect(spyDelete).toHaveBeenCalledWith(mockItem);
            await defaultIndex.update(mockItem); expect(spyUpdate).toHaveBeenCalledWith(mockItem);
            
            defaultIndex.move(mockItem, 1); expect(spyMove).toHaveBeenCalledWith(mockItem, 1);
            await defaultIndex.save(); expect(spySave).toHaveBeenCalled();
            
            await defaultIndex.filter('tag'); expect(spyFilter).toHaveBeenCalledWith('tag');
            await defaultIndex.saveTagOrder('tag', []); expect(spyTagOrder).toHaveBeenCalledWith('tag', []);
            defaultIndex.search('q'); expect(spySearch).toHaveBeenCalledWith('q');

            // Test list functionality
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: [Constants.CURRENT_TAG] }),
                new Page({ filename: '2', tags: [Constants.ARCHIVE_TAG, Constants.CURRENT_TAG] }),
                new Page({ filename: '3', tags: ['ideas'] }) // missing current
            ];
            const list = defaultIndex.list();
            expect(list).toHaveLength(1);
            expect(list[0].filename).toBe('1');

            expect(defaultIndex.tagName).toBe(Constants.CURRENT_TAG);
            expect(defaultIndex.indexFileName).toBe('index.json');

            vi.restoreAllMocks();
        });
    });

    describe('archiveIndex Facade', () => {

        it('maps methods to UnifiedIndex and overrides tags properly', async () => {
            const spyInit = vi.spyOn(UnifiedIndex, 'init').mockResolvedValue();
            const spyRead = vi.spyOn(UnifiedIndex, 'read').mockResolvedValue();
            const spyAppend = vi.spyOn(UnifiedIndex, 'append').mockResolvedValue();
            const spyPrepend = vi.spyOn(UnifiedIndex, 'prepend').mockResolvedValue();
            const spyDelete = vi.spyOn(UnifiedIndex, 'delete').mockResolvedValue();
            const spyUpdate = vi.spyOn(UnifiedIndex, 'update').mockResolvedValue();
            const spyMove = vi.spyOn(UnifiedIndex, 'move').mockReturnValue();
            const spySave = vi.spyOn(UnifiedIndex, 'save').mockResolvedValue();
            const spyFilter = vi.spyOn(UnifiedIndex, 'filterByTag').mockResolvedValue();
            const spyTagOrder = vi.spyOn(UnifiedIndex, 'saveTagOrder').mockResolvedValue();
            const spySearch = vi.spyOn(UnifiedIndex, 'search').mockReturnValue([]);

            await archiveIndex.init(); expect(spyInit).toHaveBeenCalled();
            await archiveIndex.read(); expect(spyRead).toHaveBeenCalled();

            const mockItem1 = new Page({ filename: 'f1', tags: [Constants.CURRENT_TAG] });
            await archiveIndex.append({ ...mockItem1 }); 
            // Append should mutate the tags: add archive, remove current. But let's check spy call args.
            let appended = spyAppend.mock.calls[0][0];
            expect(appended.tags).toContain(Constants.ARCHIVE_TAG);
            expect(appended.tags).not.toContain(Constants.CURRENT_TAG);

            // Coverage for missing tags on append
            await archiveIndex.append(new Page({ filename: 'f-no-tags' })); 
            appended = spyAppend.mock.calls[1][0];
            expect(appended.tags).toContain(Constants.ARCHIVE_TAG);

            // Coverage for missing tags on prepend
            await archiveIndex.prepend(new Page({ filename: 'p-no-tags' })); 
            let prepended = spyPrepend.mock.calls[0][0];
            expect(prepended.tags).toContain(Constants.ARCHIVE_TAG);

            const mockItem2 = new Page({ filename: 'f2', tags: [Constants.CURRENT_TAG] });
            await archiveIndex.prepend({ ...mockItem2 });
            prepended = spyPrepend.mock.calls[1][0];
            expect(prepended.tags).toContain(Constants.ARCHIVE_TAG);
            expect(prepended.tags).not.toContain(Constants.CURRENT_TAG);

            await archiveIndex.delete(mockItem1); expect(spyDelete).toHaveBeenCalled();
            await archiveIndex.update(mockItem1); expect(spyUpdate).toHaveBeenCalled();
            archiveIndex.move(mockItem1, 1); expect(spyMove).toHaveBeenCalled();
            await archiveIndex.save(); expect(spySave).toHaveBeenCalled();
            await archiveIndex.filter('tag'); expect(spyFilter).toHaveBeenCalled();
            await archiveIndex.saveTagOrder('tag', []); expect(spyTagOrder).toHaveBeenCalled();
            archiveIndex.search('q'); expect(spySearch).toHaveBeenCalled();

            // Test list functionality
            UnifiedIndex.items = [
                new Page({ filename: '1', tags: [Constants.CURRENT_TAG] }),
                new Page({ filename: '2', tags: [Constants.ARCHIVE_TAG] }),
            ];
            const list = archiveIndex.list();
            expect(list).toHaveLength(1);
            expect(list[0].filename).toBe('2');

            expect(archiveIndex.tagName).toBe(Constants.ARCHIVE_TAG);
            expect(archiveIndex.indexFileName).toBe('archive.json');

            vi.restoreAllMocks();
        });
    });

    // Characterises which pages each index shows today. One shared set of pages is used
    // so the rules can be compared side by side. These pin current behaviour before the
    // predicates are refactored.
    describe('Index membership rules', () => {
        const pages = () => [
            { filename: 'cur', tags: [Constants.CURRENT_TAG] },
            { filename: 'arch', tags: [Constants.ARCHIVE_TAG] },
            { filename: 'arch-cur', tags: [Constants.ARCHIVE_TAG, Constants.CURRENT_TAG] },
            { filename: 'ideas', tags: ['ideas'] },
            { filename: 'ideas-arch', tags: ['ideas', Constants.ARCHIVE_TAG] },
            { filename: 'bare' },
        ];
        const names = (list) => list.map((p) => p.filename);

        beforeEach(() => {
            UnifiedIndex.items = pages();
            db.getOrder.mockResolvedValue(null);
            search.search.mockReset();
        });

        it('default index shows only current, non-archived pages', () => {
            expect(names(defaultIndex.list())).toEqual(['cur']);
        });

        it('archive index shows only archived pages, whether or not they are current', () => {
            expect(names(archiveIndex.list())).toEqual(['arch', 'arch-cur', 'ideas-arch']);
        });

        it('filterByTag(null) shows non-archived pages, including ones with no reserved tag', async () => {
            // Differs from defaultIndex.list: 'ideas' and 'bare' are not current but still appear.
            expect(names(await UnifiedIndex.filterByTag(null))).toEqual(['cur', 'ideas', 'bare']);
        });

        it('filterByTag(CURRENT_TAG) matches the default index', async () => {
            expect(names(await UnifiedIndex.filterByTag(Constants.CURRENT_TAG))).toEqual(
                names(defaultIndex.list())
            );
        });

        it('filterByTag(ARCHIVE_TAG) matches the archive index', async () => {
            expect(names(await UnifiedIndex.filterByTag(Constants.ARCHIVE_TAG))).toEqual(
                names(archiveIndex.list())
            );
        });

        it('filterByTag(custom) excludes archived pages that carry the tag', async () => {
            expect(names(await UnifiedIndex.filterByTag('ideas'))).toEqual(['ideas']);
        });

        it('tag index list excludes archived pages that carry the tag', () => {
            expect(names(UnifiedIndex.getTagIndex('ideas').list())).toEqual(['ideas']);
        });

        it('default index search returns only current, non-archived matches', () => {
            search.search.mockReturnValue(pages().map((p) => ({ id: p.filename, score: 1 })));
            expect(names(defaultIndex.search('q'))).toEqual(['cur']);
        });

        it('archive index search returns only archived matches', () => {
            search.search.mockReturnValue(pages().map((p) => ({ id: p.filename, score: 1 })));
            expect(names(archiveIndex.search('q'))).toEqual(['arch', 'arch-cur', 'ideas-arch']);
        });

        it('empty query returns the same membership as the list', () => {
            expect(names(defaultIndex.search(''))).toEqual(names(defaultIndex.list()));
            expect(names(archiveIndex.search(''))).toEqual(names(archiveIndex.list()));
        });
    });
});
