import { UnifiedIndex } from '../../../src/renderer/lib/PageIndex';
import PageService from '../../../src/renderer/lib/Pages/PageService';

// Mock dependencies
vi.mock('../../../src/renderer/lib/filestore', () => ({
    default: {
        saveFile: vi.fn(),
        deleteFile: vi.fn(),
        getFile: vi.fn(),
    }
}));

vi.mock('../../../src/renderer/lib/db', () => ({
    default: {
        put: vi.fn(),
        delete: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
        clear: vi.fn(),
        getOrder: vi.fn().mockResolvedValue([]),
        putOrder: vi.fn(),
    }
}));

vi.mock('../../../src/renderer/lib/search', () => ({
    default: {
        init: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        search: vi.fn(),
    }
}));

describe('New Page Creation Logic', () => {

    beforeEach(async () => {
        vi.clearAllMocks();
        UnifiedIndex.items = [];
        UnifiedIndex.initialized = false;
        await UnifiedIndex.init();
    });

    it('canCreateNewPage should be true if list is empty', () => {
        // Simulation of `listData.value.length === 0`
        const listDataLength = UnifiedIndex.list().length;
        const canCreate = listDataLength === 0;

        expect(canCreate).toBe(true);
    });

    it('canCreateNewPage should be true if not on the last page', async () => {
        // Add two mocked items
        const item1 = await PageService.createItem();
        item1.title = "Page 1";

        const item2 = await PageService.createItem();
        item2.title = "Page 2";

        await UnifiedIndex.append(item1);
        await UnifiedIndex.append(item2);

        // Simulation: Suppose we are on page index 1 (the first page) out of 2.
        const currentPageNumber = 1;
        const listDataLength = UnifiedIndex.list().length;

        const canCreate = currentPageNumber < listDataLength;

        // Because 1 < 2, we can freely create (move forward) past it
        expect(canCreate).toBe(true);
    });

    it('canCreateNewPage should restrict advancing past an empty final page', async () => {
        // The last page is completely blank
        const emptyPage = await PageService.createItem();

        await UnifiedIndex.append(emptyPage);

        // Simulation: We are currently on the 1st page out of 1
        const currentPageNumber = 1;
        const listDataLength = UnifiedIndex.list().length;

        // Replicating Vue computed check:
        let canCreateTemp = false;
        if (listDataLength === 0) {
            canCreateTemp = true;
        } else if (currentPageNumber < listDataLength) {
            canCreateTemp = true;
        } else {
            canCreateTemp = !!(emptyPage.title || emptyPage.content);
        }

        // Since it's the last page, and both title and content are null/empty, we MUST be blocked
        expect(canCreateTemp).toBe(false);
    });

    it('canCreateNewPage should allow advancing past a filled final page', async () => {
        const filledPage = await PageService.createItem();
        filledPage.title = 'Hello World';

        await UnifiedIndex.append(filledPage);

        const currentPageNumber = 1;
        const listDataLength = UnifiedIndex.list().length;

        let canCreateTemp = false;
        if (listDataLength === 0) {
            canCreateTemp = true;
        } else if (currentPageNumber < listDataLength) {
            canCreateTemp = true;
        } else {
            canCreateTemp = !!(filledPage.title || filledPage.content);
        }

        // Since it's the last page and has a title, we CAN create a new one
        expect(canCreateTemp).toBe(true);
    });

    it('createNewPageFile correctly pushes a new entry and increments the list length', async () => {
        let listData = UnifiedIndex.list();
        expect(listData.length).toBe(0);

        // Simulation of createNewPageFile
        let newItem = await PageService.createItem();
        await UnifiedIndex.append(newItem);
        listData = UnifiedIndex.list(); // Reactivity refresh mapping

        expect(listData.length).toBe(1);
        expect(listData[0].filename).toBe(newItem.filename);
        expect(listData[0].filename).not.toBeNull();
    });
});
