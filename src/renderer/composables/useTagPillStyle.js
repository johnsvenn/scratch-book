import { getAutoColor, RESERVED_TAGS } from '../lib/TagMeta';

/**
 * Provides shared tag pill colour helpers given a reactive source of tag colours.
 *
 * @param {import('vue').Ref<Map<string,string>|Object>} tagColorsRef
 *   A Vue ref holding either a Map<tagName, hex> or a plain object keyed by tag name.
 * @returns {{ getTagColor: Function, pillStyle: Function }}
 */
export function useTagPillStyle(tagColorsRef) {
    /**
     * Returns the hex colour for a tag, falling back to the auto-generated colour.
     * @param {string} tagName
     * @returns {string}
     */
    function getTagColor(tagName) {
        const colors = tagColorsRef.value;
        if (colors instanceof Map) return colors.get(tagName) ?? getAutoColor(tagName);
        return colors[tagName] ?? getAutoColor(tagName);
    }

    /**
     * Returns a style object (backgroundColor, borderColor, color) for a tag pill.
     * Returns an empty object if the hex colour is not a valid 6-digit value.
     * @param {string} tagName
     * @returns {object}
     */
    function pillStyle(tagName) {
        const hex = getTagColor(tagName);
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return {};
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return {
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
            borderColor:     `rgba(${r}, ${g}, ${b}, 0.3)`,
            color:           `rgb(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)})`,
        };
    }

    return { getTagColor, pillStyle };
}

/**
 * Filters a tag list (Array or comma-separated string) to only user-visible tags,
 * stripping out reserved system tags such as 'current', 'archive', and 'favourite'.
 *
 * @param {string[]|string|null|undefined} tags
 * @returns {string[]}
 */
export function filterUserTags(tags) {
    if (!tags) return [];
    const arr = Array.isArray(tags) ? tags : String(tags).split(',');
    return arr.map(t => t.trim()).filter(t => t && !RESERVED_TAGS.has(t));
}
