import TagMeta, { getAutoColor, TAG_COLORS } from '../../../src/renderer/lib/TagMeta';
import db from '../../../src/renderer/lib/db';

vi.mock('../../../src/renderer/lib/db', () => ({
    default: {
        getAllTagMeta: vi.fn().mockResolvedValue([]),
        putTagMeta: vi.fn(),
        deleteTagMeta: vi.fn()
    }
}));

describe('TagMeta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        TagMeta.reset();
    });

    it('getAutoColor deterministically assigns colors based on hash', () => {
        const c1 = getAutoColor('ideas');
        const c2 = getAutoColor('work');
        
        expect(TAG_COLORS).toContain(c1);
        expect(TAG_COLORS).toContain(c2);
        
        // Same string returns same color
        expect(getAutoColor('ideas')).toBe(c1);
    });

    it('getAll loads from db and caches', async () => {
        db.getAllTagMeta.mockResolvedValueOnce([
            { name: 'ideas', color: '#9b7fd4' },
            { name: 'work', color: '#4caf82' }
        ]);

        const map = await TagMeta.getAll();
        expect(db.getAllTagMeta).toHaveBeenCalledTimes(1);
        expect(map.get('ideas')).toBe('#9b7fd4');
        expect(map.get('work')).toBe('#4caf82');

        // Subsequent call uses cache
        const map2 = await TagMeta.getAll();
        expect(db.getAllTagMeta).toHaveBeenCalledTimes(1); // Still 1
        expect(map2).toBe(map);
    });

    it('getColor falls back to auto color if not set', async () => {
        db.getAllTagMeta.mockResolvedValueOnce([]);
        const color = await TagMeta.getColor('new-tag');
        expect(color).toBe(getAutoColor('new-tag'));
    });

    it('set saves to db and updates cache', async () => {
        db.getAllTagMeta.mockResolvedValueOnce([]);
        await TagMeta.set('personal', '#e05c8a');
        
        expect(db.putTagMeta).toHaveBeenCalledWith({ name: 'personal', color: '#e05c8a' });
        
        const map = await TagMeta.getAll();
        expect(map.get('personal')).toBe('#e05c8a');
    });

    it('remove deletes from db and cache', async () => {
        db.getAllTagMeta.mockResolvedValueOnce([
            { name: 'personal', color: '#e05c8a' }
        ]);

        await TagMeta.remove('personal');
        expect(db.deleteTagMeta).toHaveBeenCalledWith('personal');
        
        const map = await TagMeta.getAll();
        expect(map.has('personal')).toBe(false);
    });

    it('ensureColors assigns colors for missing tags', async () => {
        db.getAllTagMeta.mockResolvedValueOnce([
            { name: 'work', color: '#4caf82' }
        ]);

        const map = await TagMeta.ensureColors(['work', 'ideas', 'reading']);
        
        expect(map.get('work')).toBe('#4caf82');
        expect(map.has('ideas')).toBe(true);
        expect(map.has('reading')).toBe(true);
        
        // Two DB inserts should have occurred
        expect(db.putTagMeta).toHaveBeenCalledTimes(2);
        expect(db.putTagMeta).toHaveBeenCalledWith(expect.objectContaining({ name: 'ideas' }));
    });
});
