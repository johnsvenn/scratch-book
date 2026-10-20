import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stubs & mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../../src/renderer/components/BaseModal/BaseModal.vue', () => ({
    default: {
        name: 'BaseModal',
        template: '<div><slot /></div>',
        props: ['title'],
        emits: ['close'],
    },
}));

vi.mock('../../../../src/renderer/components/BaseButton/BaseButton.vue', () => ({
    default: {
        name: 'BaseButton',
        template: '<button :disabled="disabled" type="submit"><slot /></button>',
        props: ['disabled'],
    },
}));

vi.mock('../../../../src/renderer/lib/search', () => ({
    default: {
        search: vi.fn(),
    },
}));

vi.mock('../../../../src/renderer/lib/TagMeta', () => ({
    default: {
        getAll: vi.fn().mockResolvedValue(new Map([['work', '#ff0000']])),
    },
}));

vi.mock('../../../../src/renderer/lib/DatetimeFunctions', () => ({
    formatDate: vi.fn((v) => (v ? `formatted:${v}` : '')),
}));

vi.mock('../../../../src/renderer/composables/useTagPillStyle', () => ({
    useTagPillStyle: vi.fn(() => ({
        getTagColor: vi.fn(() => '#ff0000'),
        pillStyle: vi.fn(() => ({ backgroundColor: 'rgba(255,0,0,0.1)' })),
    })),
    filterUserTags: vi.fn((tags) =>
        (Array.isArray(tags) ? tags : []).filter(
            (t) => !['current', 'archive', 'favourite'].includes(t)
        )
    ),
}));

vi.mock('../../../../src/renderer/lib/PageIndex', () => ({
    UnifiedIndex: {
        items: [
            { filename: 'page1' },
            { filename: 'p1' },
        ],
    },
}));

vi.mock('../../../../src/renderer/lib/filestore', () => ({
    default: {
        listFiles: vi.fn().mockResolvedValue(['page1', 'p1']),
    },
}));

import SearchModal from '../../../../src/renderer/components/Navigation/SearchModal.vue';
import searchLib from '../../../../src/renderer/lib/search';
import { searchStore } from '../../../../src/renderer/composables/searchStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountModal(props = {}) {
    return mount(SearchModal, {
        props,
        attachTo: document.body, // needed for focus/select assertions
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SearchModal.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchLib.search.mockReturnValue([]);
        searchStore.query = '';
        searchStore.results = [];
        searchStore.hasSearched = false;
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    it('renders the search input and submit button', () => {
        const wrapper = mountModal();
        expect(wrapper.find('.search-modal__input').exists()).toBe(true);
        expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
    });

    it('disables the submit button when the query is empty', () => {
        const wrapper = mountModal();
        const btn = wrapper.find('button[type="submit"]');
        expect(btn.attributes('disabled')).toBeDefined();
    });

    it('enables the submit button once the query has text', async () => {
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('hello');
        const btn = wrapper.find('button[type="submit"]');
        // disabled attribute should be absent
        expect(btn.element.disabled).toBe(false);
    });

    // ── Search behaviour ──────────────────────────────────────────────────────

    it('calls search.search with the trimmed query on form submit', async () => {
        searchLib.search.mockReturnValue([]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('  hello  ');
        await wrapper.find('form').trigger('submit');
        await flushPromises();
        expect(searchLib.search).toHaveBeenCalledWith('hello');
    });

    it('shows the "no results" message when search returns empty', async () => {
        searchLib.search.mockReturnValue([]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('xyz');
        await wrapper.find('form').trigger('submit');
        await flushPromises();
        expect(wrapper.find('.search-modal__empty').exists()).toBe(true);
    });

    it('does not show "no results" before any search is performed', () => {
        const wrapper = mountModal();
        expect(wrapper.find('.search-modal__empty').exists()).toBe(false);
    });

    it('renders result rows when search returns matches', async () => {
        searchLib.search.mockReturnValue([
            { id: 'page1', title: 'Hello World', tags: ['work'], modifiedAt: '2026-01-01', content: 'Hello World content' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('hello');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        const results = wrapper.findAll('.search-modal__result');
        expect(results.length).toBe(1);
        expect(results[0].text()).toContain('Hello World');
    });

    it('emits navigate-to with the result id when a result row is clicked', async () => {
        searchLib.search.mockReturnValue([
            { id: 'page1', title: 'Hello World', tags: [], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('hello');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        await wrapper.find('.search-modal__result').trigger('click');
        expect(wrapper.emitted('navigate-to')).toBeTruthy();
        expect(wrapper.emitted('navigate-to')[0]).toEqual(['page1']);
    });

    // ── Modified date ─────────────────────────────────────────────────────────

    it('shows the formatted modifiedAt date on each result', async () => {
        const { formatDate } = await import('../../../../src/renderer/lib/DatetimeFunctions');
        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'My Note', tags: [], modifiedAt: '2026-03-15T10:00:00Z', content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('note');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-date').text()).toBe('formatted:2026-03-15T10:00:00Z');
        expect(formatDate).toHaveBeenCalledWith('2026-03-15T10:00:00Z');
    });

    it('omits the date element when modifiedAt is absent', async () => {
        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'No Date Note', tags: [], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('note');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-date').exists()).toBe(false);
    });

    // ── Content preview ───────────────────────────────────────────────────────

    it('renders a content preview snippet when content is present', async () => {
        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: [], modifiedAt: null, content: 'The quick brown fox jumps over the lazy dog' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('fox');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        const preview = wrapper.find('.search-modal__result-preview');
        expect(preview.exists()).toBe(true);
        expect(preview.text()).toContain('fox');
    });

    it('highlights the search term inside the preview', async () => {
        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: [], modifiedAt: null, content: 'Find this keyword here' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('keyword');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-preview').html()).toContain(
            '<mark class="search-modal__highlight">'
        );
    });

    it('omits the preview when content is empty', async () => {
        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: [], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('anything');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-preview').exists()).toBe(false);
    });

    // ── Tag pills ─────────────────────────────────────────────────────────────

    it('renders tag pills for user tags on each result', async () => {
        const { filterUserTags } = await import('../../../../src/renderer/composables/useTagPillStyle');
        filterUserTags.mockReturnValue(['work', 'personal']);

        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: ['work', 'personal', 'current'], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('t');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        const pills = wrapper.findAll('.search-modal__tag-pill');
        expect(pills.length).toBe(2);
        expect(pills[0].text()).toContain('work');
        expect(pills[1].text()).toContain('personal');
    });

    it('does not render the tag pill row when there are no user tags and it is not a favourite', async () => {
        const { filterUserTags } = await import('../../../../src/renderer/composables/useTagPillStyle');
        filterUserTags.mockReturnValue([]);

        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: ['current'], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('t');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-tags').exists()).toBe(false);
    });

    it('renders the favourite icon when a result has the favourite tag', async () => {
        const { filterUserTags } = await import('../../../../src/renderer/composables/useTagPillStyle');
        filterUserTags.mockReturnValue([]);

        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: ['favourite'], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('t');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__result-tags').exists()).toBe(true);
        expect(wrapper.find('.search-modal__fav-icon').exists()).toBe(true);
    });

    it('does not render the favourite icon when a result is not a favourite', async () => {
        const { filterUserTags } = await import('../../../../src/renderer/composables/useTagPillStyle');
        filterUserTags.mockReturnValue(['work']);

        searchLib.search.mockReturnValue([
            { id: 'p1', title: 'T', tags: ['work'], modifiedAt: null, content: '' },
        ]);
        const wrapper = mountModal();
        await wrapper.find('.search-modal__input').setValue('t');
        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.search-modal__fav-icon').exists()).toBe(false);
    });

    // ── close event ───────────────────────────────────────────────────────────

    it('emits close when BaseModal emits close', async () => {
        const wrapper = mountModal();
        await wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('close');
        expect(wrapper.emitted('close')).toBeTruthy();
    });
});
