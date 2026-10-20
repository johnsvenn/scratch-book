<template>
    <BaseModal :title="mode === 'link' ? 'Insert Link' : 'Search'" @close="$emit('close')">
        <div class="search-modal">
            <form class="search-modal__form" @submit.prevent="performSearch">
                <input ref="searchInput"
                       v-model="query"
                       type="text"
                       class="search-modal__input"
                       placeholder="Search pages..."
                       @focus="onInputFocus" />
                <BaseButton type="submit"
                            :disabled="!query.trim()">Search</BaseButton>
            </form>

            <div v-if="hasSearched && results.length === 0" class="search-modal__empty">
                No results found.
            </div>

            <ul v-if="results.length" class="search-modal__results">
                <li v-for="result in results"
                    :key="result.id"
                    class="search-modal__result"
                    @click="onResultClick(result)">

                    <!-- Title row: title on left, date on right -->
                    <div class="search-modal__result-header">
                        <div class="search-modal__result-title">{{ result.title || 'Untitled' }}</div>
                        <div v-if="result.modifiedAt" class="search-modal__result-date">
                            {{ formatDate(result.modifiedAt) }}
                        </div>
                    </div>

                    <!-- Content preview snippet -->
                    <div v-if="getPreview(result)" class="search-modal__result-preview">
                        <!-- eslint-disable-next-line vue/no-v-html -->
                        <span v-html="getPreview(result)"></span>
                    </div>

                    <!-- Tag pills (display-only, matching PageTagPills style) -->
                    <div v-if="userTags(result).length || isFavourite(result)" class="search-modal__result-tags">
                        <Heart v-if="isFavourite(result)" class="search-modal__fav-icon" :size="13" />
                        <span v-for="tag in userTags(result)"
                              :key="tag"
                              class="search-modal__tag-pill"
                              :style="pillStyle(tag)">
                            <span class="search-modal__tag-dot" :style="{ background: getTagColor(tag) }"></span>
                            {{ tag }}
                        </span>
                    </div>
                </li>
            </ul>
        </div>
    </BaseModal>
</template>

<script>
    // Module-level state is now in searchStore.js so it can be reset in tests.
</script>

<script setup>
    import { ref, onMounted } from 'vue';
    import { Heart } from 'lucide-vue-next';
    import BaseButton from '../BaseButton/BaseButton.vue';
    import BaseModal from '../BaseModal/BaseModal.vue';
    import search from '../../lib/search';
    import { formatDate } from '../../lib/DatetimeFunctions';
    import { useTagPillStyle, filterUserTags } from '../../composables/useTagPillStyle';
    import TagMeta from '../../lib/TagMeta';
    import { searchStore } from '../../composables/searchStore';
    import { UnifiedIndex } from '../../lib/PageIndex';
    import filestore from '../../lib/filestore';

    const props = defineProps({
        /**
         * 'navigate' (default) — clicking a result navigates to the page.
         * 'link'     — clicking a result fires @pick-page with the full page object
         *              so the caller can insert a page:// link.
         */
        mode: {
            type: String,
            default: 'navigate',
            validator: (v) => ['navigate', 'link'].includes(v),
        },
    });

    const emit = defineEmits(['close', 'navigate-to', 'pick-page']);

    const searchInput = ref(null);

    function onResultClick(result) {
        if (props.mode === 'link') {
            // Pass back the full page object so the caller can check for a slug
            const page = UnifiedIndex.items.find(p => p.filename === result.id);
            emit('pick-page', page || { filename: result.id, title: result.title });
        } else {
            emit('navigate-to', result.id);
        }
    }

    // Clean up cached search results immediately before initial render
    const validIds = new Set(UnifiedIndex.items.map(p => p.filename));
    searchStore.results = searchStore.results.filter(r => validIds.has(r.id));
    
    const query      = ref(searchStore.query);
    const results    = ref(searchStore.results);
    const hasSearched = ref(searchStore.hasSearched);

    // Tag colour cache (loaded async once per component life)
    const tagColorMap = ref(new Map());

    onMounted(async () => {
        searchInput.value?.focus();
        
        // Refresh search results to exclude any pages deleted since last search
        if (query.value) {
            performSearch();
        }

        // Load tag colours for pill rendering
        try {
            tagColorMap.value = await TagMeta.getAll();
        } catch {
            // Fall back to auto colours silently
        }
    });

    /** Select all text when the user clicks into the search box */
    function onInputFocus() {
        searchInput.value?.select();
    }

    async function performSearch() {
        const term = query.value.trim();
        if (!term) {
            results.value     = [];
            hasSearched.value = false;
            searchStore.query      = '';
            searchStore.results    = [];
            searchStore.hasSearched = false;
            return;
        }
        
        const rawResults = search.search(term);
        
        // Exclude pages that appear to have been deleted or do not exist in memory
        const memoryValidIds = new Set(UnifiedIndex.items.map(p => p.filename));
        
        // Double-check against actual filesystem for absolute accuracy
        let diskValidIds = null;
        try {
            const diskFiles = await filestore.listFiles();
            diskValidIds = new Set(diskFiles);
        } catch (e) {
            console.error('Failed to list files from disk for search validation', e);
        }

        results.value = rawResults.filter(r => {
            const inMemory = memoryValidIds.has(r.id);
            const onDisk = diskValidIds ? diskValidIds.has(r.id) : true;
            return inMemory && onDisk;
        });
        
        hasSearched.value = true;

        // Persist for next open
        searchStore.query      = query.value;
        searchStore.results    = results.value;
        searchStore.hasSearched = true;
    }

    // ── Tag helpers (via shared composable) ──────────────────────────────────

    const { getTagColor, pillStyle } = useTagPillStyle(tagColorMap);

    function userTags(result) {
        return filterUserTags(result.tags);
    }

    function isFavourite(result) {
        return result.tags?.includes('favourite') || false;
    }

    // ── Content preview ───────────────────────────────────────────────────────

    const PREVIEW_RADIUS = 120; // chars each side of the first match

    function getPreview(result) {
        const raw = result.content;
        const term = query.value.trim();
        if (!raw || !term) return '';

        const lower  = raw.toLowerCase();
        const termLc = term.toLowerCase();
        const idx    = lower.indexOf(termLc);

        let snippet;
        let prefixEllipsis  = '';
        let suffixEllipsis  = '';

        if (idx === -1) {
            // Term not literally present (fuzzy / prefix match) — show start of content
            snippet = raw.slice(0, PREVIEW_RADIUS * 2);
            if (raw.length > PREVIEW_RADIUS * 2) suffixEllipsis = '…';
        } else {
            const start = Math.max(0, idx - PREVIEW_RADIUS);
            const end   = Math.min(raw.length, idx + termLc.length + PREVIEW_RADIUS);
            snippet = raw.slice(start, end);
            if (start > 0)          prefixEllipsis = '…';
            if (end < raw.length)   suffixEllipsis = '…';
        }

        // Sanitise (strip any HTML), then highlight the term
        const safe = snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const highlighted = safe.replace(
            new RegExp(escapeRegex(term), 'gi'),
            match => `<mark class="search-modal__highlight">${match}</mark>`
        );

        return `${prefixEllipsis}${highlighted}${suffixEllipsis}`;
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
</script>

<style scoped lang="scss">
    @use 'sass:color';

    .search-modal {
        padding: 16px 20px;
    }

    .search-modal__form {
        display: flex;
        gap: 8px;
    }

    .search-modal__input {
        flex: 1;
        height: 34px;
        padding: 0 10px;
        border: 1px solid $grey-400;
        border-radius: 4px;
        font-size: 14px;
        outline: none;

        &:focus {
            border-color: $grey-550;
        }
    }

    .search-modal__empty {
        padding: 24px 0;
        text-align: center;
        color: $grey-600;
        font-size: 14px;
    }

    .search-modal__results {
        list-style: none;
        padding: 0;
        margin: 12px 0 0 0;
    }

    .search-modal__result {
        padding: 10px 8px;
        border-bottom: 1px solid $grey-200;
        cursor: pointer;
        border-radius: 4px;

        &:hover {
            background: $grey-150;
        }

        &:last-child {
            border-bottom: none;
        }
    }

    /* Title + date on one line */
    .search-modal__result-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    }

    .search-modal__result-title {
        font-size: 14px;
        font-weight: 500;
        color: $grey-800;
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .search-modal__result-date {
        font-size: 11px;
        color: $grey-500;
        white-space: nowrap;
        flex-shrink: 0;
    }

    /* Content preview */
    .search-modal__result-preview {
        font-size: 12px;
        color: $grey-600;
        line-height: 1.5;
        margin-bottom: 6px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* Tag pills — mirrors PageTagPills style */
    .search-modal__result-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
    }

    .search-modal__fav-icon {
        color: $danger-500;
        margin-right: 2px;
        flex-shrink: 0;
    }

    .search-modal__tag-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 20px;
        padding: 0 8px;
        font-size: 11px;
        border: 1px solid $grey-400;
        border-radius: 10px;
        background: $white;
        color: $grey-725;
        box-sizing: border-box;
        line-height: 18px;
        pointer-events: none; // display-only
    }

    .search-modal__tag-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    /* Search term highlight inside preview */
    :deep(.search-modal__highlight) {
        background: rgba(255, 200, 0, 0.35);
        border-radius: 2px;
        padding: 0 1px;
        font-weight: 600;
        color: inherit;
    }
</style>
