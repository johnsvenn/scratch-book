import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// Mock TagMeta so getAutoColor is deterministic and RESERVED_TAGS is available
vi.mock('../../../src/renderer/lib/TagMeta', () => ({
    getAutoColor: vi.fn((name) => `#auto-${name}`),
    RESERVED_TAGS: new Set(['current', 'archive', 'favourite']),
}));

import { useTagPillStyle, filterUserTags } from '../../../src/renderer/composables/useTagPillStyle';

describe('useTagPillStyle', () => {
    describe('getTagColor', () => {
        it('reads colour from a Map', () => {
            const colorsRef = ref(new Map([['work', '#ff0000']]));
            const { getTagColor } = useTagPillStyle(colorsRef);
            expect(getTagColor('work')).toBe('#ff0000');
        });

        it('reads colour from a plain object', () => {
            const colorsRef = ref({ work: '#ff0000' });
            const { getTagColor } = useTagPillStyle(colorsRef);
            expect(getTagColor('work')).toBe('#ff0000');
        });

        it('falls back to getAutoColor when the tag is not in the Map', async () => {
            const { getAutoColor } = await import('../../../src/renderer/lib/TagMeta');
            const colorsRef = ref(new Map());
            const { getTagColor } = useTagPillStyle(colorsRef);
            expect(getTagColor('unknown')).toBe('#auto-unknown');
            expect(getAutoColor).toHaveBeenCalledWith('unknown');
        });

        it('falls back to getAutoColor when the tag is not in the plain object', async () => {
            const { getAutoColor } = await import('../../../src/renderer/lib/TagMeta');
            const colorsRef = ref({});
            const { getTagColor } = useTagPillStyle(colorsRef);
            expect(getTagColor('missing')).toBe('#auto-missing');
            expect(getAutoColor).toHaveBeenCalledWith('missing');
        });
    });

    describe('pillStyle', () => {
        it('returns backgroundColor, borderColor and color for a valid hex colour', () => {
            // #336699 → r=51, g=102, b=153
            const colorsRef = ref(new Map([['dev', '#336699']]));
            const { pillStyle } = useTagPillStyle(colorsRef);
            const style = pillStyle('dev');

            expect(style.backgroundColor).toBe('rgba(51, 102, 153, 0.1)');
            expect(style.borderColor).toBe('rgba(51, 102, 153, 0.3)');
            // Darker text: r-40=11, g-40=62, b-40=113
            expect(style.color).toBe('rgb(11, 62, 113)');
        });

        it('returns an empty object when colour is not a valid 6-digit hex', async () => {
            const { getAutoColor } = await import('../../../src/renderer/lib/TagMeta');
            // getAutoColor returns '#auto-bad' which is not a valid hex
            const colorsRef = ref(new Map());
            const { pillStyle } = useTagPillStyle(colorsRef);
            expect(pillStyle('bad')).toEqual({});
        });

        it('clamps RGB channels at 0 so they never go negative', () => {
            // #000000 → r=g=b=0; subtracting 40 should clamp at 0
            const colorsRef = ref(new Map([['dark', '#000000']]));
            const { pillStyle } = useTagPillStyle(colorsRef);
            const style = pillStyle('dark');
            expect(style.color).toBe('rgb(0, 0, 0)');
        });
    });
});

describe('filterUserTags', () => {
    it('returns an empty array for null/undefined', () => {
        expect(filterUserTags(null)).toEqual([]);
        expect(filterUserTags(undefined)).toEqual([]);
    });

    it('filters out reserved tags from an array', () => {
        expect(filterUserTags(['work', 'current', 'archive', 'favourite', 'personal']))
            .toEqual(['work', 'personal']);
    });

    it('handles a comma-separated string', () => {
        expect(filterUserTags('work,current,personal')).toEqual(['work', 'personal']);
    });

    it('trims whitespace around tag names', () => {
        expect(filterUserTags([' work ', ' personal '])).toEqual(['work', 'personal']);
    });

    it('filters out empty strings produced by splitting', () => {
        expect(filterUserTags('work,,personal')).toEqual(['work', 'personal']);
    });

    it('returns an empty array when all tags are reserved', () => {
        expect(filterUserTags(['current', 'archive', 'favourite'])).toEqual([]);
    });
});
