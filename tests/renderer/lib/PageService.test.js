import PageService from '../../../src/renderer/lib/Pages/PageService';
import filestore from '../../../src/renderer/lib/filestore';
import db from '../../../src/renderer/lib/db';
import Page from '../../../src/renderer/lib/Pages/Page';
import fileFormatter from '../../../src/renderer/lib/fileFormatter';

// Mock dependencies
vi.mock('../../../src/renderer/lib/filestore', () => ({
    default: {
        saveFile: vi.fn(),
        getFile: vi.fn(),
        deleteFile: vi.fn(),
    }
}));

vi.mock('../../../src/renderer/lib/db', () => ({
    default: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
    }
}));

describe('PageService Persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should save page content to file system', async () => {
        const page = new Page({
            filename: 'test-page',
            title: 'Test Title',
            content: 'Test Content'
        });

        await PageService.updateItem(page);

        expect(filestore.saveFile).toHaveBeenCalledWith(
            'test-page/index.md',
            expect.stringContaining('Test Content')
        );
    });

    it('should NOT save a new page if both title and content are empty or whitespace', async () => {
        const testCases = [
            { title: '', content: '' },
            { title: '   ', content: '' },
            { title: '', content: '   ' },
            { title: ' \n\t ', content: '   ' },
        ];

        for (const testCase of testCases) {
            const emptyPage = new Page(testCase);
            await PageService.updateItem(emptyPage);
            expect(filestore.saveFile).not.toHaveBeenCalled();
            expect(db.put).not.toHaveBeenCalled();
            vi.clearAllMocks();
        }
    });

    it('should NOT persist if item has no filename', async () => {
        const page = new Page();
        page.filename = ''; 
        // Force the filename to be empty and call _persistItem directly
        // because updateItem re-runs new Page() which might auto-generate a filename
        await PageService._persistItem(page);
        expect(filestore.saveFile).not.toHaveBeenCalled();
        expect(db.put).not.toHaveBeenCalled();
    });

    it('should save if title is non-empty even if content is whitespace', async () => {
        const page = new Page({
            filename: 'test-page',
            title: 'Valid Title',
            content: '   '
        });

        await PageService.updateItem(page);
        expect(filestore.saveFile).toHaveBeenCalled();
        expect(db.put).toHaveBeenCalled();
    });

    it('should save if content is non-empty even if title is whitespace', async () => {
        const page = new Page({
            filename: 'test-page',
            title: '   ',
            content: 'Valid Content'
        });

        await PageService.updateItem(page);
        expect(filestore.saveFile).toHaveBeenCalled();
        expect(db.put).toHaveBeenCalled();
    });

    it('should save page content to IndexedDB', async () => {
        const page = new Page({
            filename: 'test-page',
            title: 'Test Title',
            content: 'Test Content'
        });

        await PageService.updateItem(page);

        expect(db.put).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Test Content'
        }));
    });

    it('should SOFT DELETE from filesystem and DB if the page is empty', async () => {
        const page = new Page({
            filename: 'empty-one',
            title: '',
            content: ''
        });

        db.get.mockResolvedValue(page);
        await PageService.updateItem(page);
        expect(filestore.saveFile).toHaveBeenCalledWith(
            'empty-one/index.md',
            expect.stringContaining('"isDeleted": true')
        );
        expect(filestore.saveFile).toHaveBeenCalledWith(
            'empty-one/index.md',
            expect.stringContaining('"filename": "empty-one"')
        );
        expect(db.delete).toHaveBeenCalledWith('empty-one');
    });

    describe('createItem and newItem', () => {
        it('newItem should return a new instance of Page', () => {
            const item = PageService.newItem();
            expect(item).toBeInstanceOf(Page);
        });

        it('createItem should create a new item but NOT persist it', async () => {
            const spyNewItem = vi.spyOn(PageService, 'newItem');
            const spyPersist = vi.spyOn(PageService, '_persistItem').mockResolvedValue();

            const item = await PageService.createItem();

            expect(spyNewItem).toHaveBeenCalled();
            expect(spyPersist).not.toHaveBeenCalled();
            expect(item).toBeInstanceOf(Page);

            spyNewItem.mockRestore();
            spyPersist.mockRestore();
        });
    });

    describe('getItemByFileName', () => {
        beforeEach(() => {
            filestore.getFile.mockReset();
        });

        it('should return a new item if filename is not provided', async () => {
            const spy = vi.spyOn(PageService, 'createItem').mockResolvedValue('MockItem');
            const [json, data] = await PageService.getItemByFileName(null);
            expect(spy).toHaveBeenCalled();
            expect(data).toBe('');
            spy.mockRestore();
        });

        it('should load from bundle format if bundle exists', async () => {
            filestore.getFile.mockImplementation(async (path) => {
                if (path === 'test-page/index.md') {
                    return '{"title": "Test"}\n++++++++++\nContent body';
                }
                return null;
            });
            const [json, data] = await PageService.getItemByFileName('test-page');
            expect(json.title).toBe('Test');
            expect(data).toBe('Content body');
        });

        it('should fallback to flat file format if bundle does not exist', async () => {
            filestore.getFile.mockImplementation(async (path) => {
                if (path === 'fallback-page.txt') {
                    return '{"title": "Fallback"}\n++++++++++\nFallback body';
                }
                return null;
            });
            const [json, data] = await PageService.getItemByFileName('fallback-page');
            expect(json.title).toBe('Fallback');
            expect(data).toBe('Fallback body');
        });

        it('should create new item if extract returns empty json and data', async () => {
            filestore.getFile.mockResolvedValue('dummy-file-content');
            vi.spyOn(fileFormatter, 'extract').mockReturnValue([null, '']);
            const spyCreate = vi.spyOn(PageService, 'createItem').mockResolvedValue('MockItem');

            const [json, data] = await PageService.getItemByFileName('some-file');
            
            expect(fileFormatter.extract).toHaveBeenCalledWith('dummy-file-content');
            expect(spyCreate).toHaveBeenCalled();
            expect(data).toBe('');

            spyCreate.mockRestore();
            fileFormatter.extract.mockRestore();
        });

        it('should upgrade from old format if json is null but data exists', async () => {
            filestore.getFile.mockResolvedValue('dummy-file-content');
            vi.spyOn(fileFormatter, 'extract').mockReturnValue([null, 'Existing Data']);
            
            const [json, data] = await PageService.getItemByFileName('legacy-file');

            expect(fileFormatter.extract).toHaveBeenCalledWith('dummy-file-content');
            expect(json).toBeInstanceOf(Page);
            expect(json.filename).toBe('legacy-file');
            expect(json.createdAt).toBe('legacy-file');
            expect(data).toBe('Existing Data');

            fileFormatter.extract.mockRestore();
        });
    });
});
