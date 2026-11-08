import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from '../../../src/renderer/components/HomePage.vue';
import { UnifiedIndex, defaultIndex } from '../../../src/renderer/lib/PageIndex';
import pageWriter from '../../../src/renderer/lib/Pages/PageWriter';
import TagMeta from '../../../src/renderer/lib/TagMeta';
import Constants from '../../../src/renderer/lib/constants';

// HomePage subscribes to the 'insert-link' IPC channel on setup
window.electronAPI = { on: vi.fn(() => () => {}) };

// Mock child components to isolate HomePage and avoid loading their dependencies
vi.mock('../../../src/renderer/components/Navigation/PageTags.vue', () => ({ default: { name: 'PageTags', template: '<div></div>', props: ['activeTagName', 'userTags', 'tagColors', 'hasFavourites'] } }));
vi.mock('../../../src/renderer/components/Navigation/PageNavigation.vue', () => ({ default: { name: 'PageNavigation', template: '<div></div>', props: ['currentPageNumber', 'listDataLength', 'canGoNext'] } }));
vi.mock('../../../src/renderer/components/Navigation/PageControls.vue', () => ({ default: { name: 'PageControls', template: '<div></div>', props: ['isFavourite', 'activeTagName', 'canCreateNewPage'] } }));
vi.mock('../../../src/renderer/components/Navigation/PageTagPills.vue', () => ({ default: { name: 'PageTagPills', template: '<div></div>', props: ['tags', 'allTags', 'tagColors', 'disabled'] } }));
vi.mock('../../../src/renderer/components/TagList/TagListModal.vue', () => ({ default: { name: 'TagListModal', template: '<div></div>', props: ['items', 'title'] } }));
vi.mock('../../../src/renderer/components/TagList/ManageTagsModal.vue', () => ({ default: { name: 'ManageTagsModal', template: '<div></div>', props: ['allTags', 'tagColors'] } }));
vi.mock('../../../src/renderer/components/Settings/SettingsModal.vue', () => ({ default: { name: 'SettingsModal', template: '<div></div>' } }));
vi.mock('../../../src/renderer/components/MarkdownRenderer.vue', () => ({ default: { name: 'MarkdownRenderer', template: '<div></div>', props: ['content'] } }));

// Mock dependencies
vi.mock('../../../src/renderer/lib/PageIndex', () => {
    const mockIndex = {
        init: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockReturnValue([]),
        getAllUserTags: vi.fn().mockReturnValue([]),
        getTagIndex: vi.fn(),
        append: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        items: [],
        tagName: 'All Pages',
    };
    return {
        UnifiedIndex: mockIndex,
        defaultIndex: mockIndex,
        archiveIndex: { tagName: 'archive', list: vi.fn().mockReturnValue([]) },
        DEFAULT_INDEX_FILENAME: 'index.json',
        ARCHIVE_INDEX_FILENAME: 'archive.json',
    };
});

vi.mock('../../../src/renderer/lib/Pages/PageWriter', () => ({
    default: {
        save: vi.fn().mockImplementation(item => Promise.resolve({ ...item, modifiedAt: new Date() })),
        remove: vi.fn().mockResolvedValue(undefined),
        renameTag: vi.fn().mockResolvedValue(0),
        removeTag: vi.fn().mockResolvedValue(0),
    }
}));

vi.mock('../../../src/renderer/lib/TagMeta', () => ({
    default: {
        ensureColors: vi.fn().mockResolvedValue(new Map()),
        getColor: vi.fn().mockResolvedValue('#aaa'),
    }
}));

vi.mock('../../../src/renderer/lib/storeFactory', () => ({
    default: vi.fn().mockReturnValue({
        deleteFile: vi.fn().mockResolvedValue(undefined),
    })
}));

// Mock global variables
global.__APP_VERSION__ = '1.0.0';
global.__COMMIT_HASH__ = 'abcdef';

describe('HomePage.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders child components correctly', async () => {
        const wrapper = mount(HomePage);
        
        // Wait for onMounted
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(wrapper.findComponent({ name: 'PageTags' }).exists()).toBe(true);
        expect(wrapper.findComponent({ name: 'PageNavigation' }).exists()).toBe(true);
        expect(wrapper.findComponent({ name: 'PageControls' }).exists()).toBe(true);
        expect(wrapper.findComponent({ name: 'PageTagPills' }).exists()).toBe(true);
    });

    it('keeps tags stored in TagMeta in the page tag picker when no page uses them', async () => {
        TagMeta.ensureColors.mockResolvedValueOnce(new Map([['urgent', '#00ff00']]));

        const wrapper = mount(HomePage);
        await new Promise(resolve => setTimeout(resolve, 0));

        const pageTagPills = wrapper.findComponent({ name: 'PageTagPills' });
        expect(pageTagPills.props('allTags')).toContainEqual({ name: 'urgent', count: 0 });
    });

    it('shows Settings modal when show-settings event is emitted', async () => {
        const wrapper = mount(HomePage);
        const pageTags = wrapper.findComponent({ name: 'PageTags' });
        
        await pageTags.trigger('show-settings'); // Event name might be different in actual emission, checking onSetIndex etc
        // Actually, looking at template: @show-settings="showSettings"
        await pageTags.vm.$emit('show-settings');
        
        expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true);
    });

    it('shows ManageTags modal when manage-tags event is emitted', async () => {
        const wrapper = mount(HomePage);
        const pageTags = wrapper.findComponent({ name: 'PageTags' });
        
        await pageTags.vm.$emit('manage-tags');
        
        expect(wrapper.findComponent({ name: 'ManageTagsModal' }).exists()).toBe(true);
    });

    it('creates a new page when create-new-page-file is emitted', async () => {
        const wrapper = mount(HomePage);
        const pageControls = wrapper.findComponent({ name: 'PageControls' });
        
        await pageControls.vm.$emit('create-new-page-file');
        
        expect(UnifiedIndex.append).toHaveBeenCalled();
    });

    it('toggles markdown mode when toggle switch is changed', async () => {
        const wrapper = mount(HomePage);
        // Wait for setup
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Initial state should be false (textarea visible)
        expect(wrapper.find('textarea').exists()).toBe(true);
        expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).exists()).toBe(false);
        
        const checkbox = wrapper.find('.page-layout__markdown-toggle input[type="checkbox"]');
        
        // Toggle on
        await checkbox.setValue(true);
        
        expect(wrapper.find('textarea').exists()).toBe(false);
        expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).exists()).toBe(true);
        
        // Toggle off
        await checkbox.setValue(false);
        
        expect(wrapper.find('textarea').exists()).toBe(true);
        expect(wrapper.findComponent({ name: 'MarkdownRenderer' }).exists()).toBe(false);
    });

    it('remembers the current page number for each tag', async () => {
        const petsItems = [{ filename: '1.json' }, { filename: '2.json' }, { filename: '3.json' }];
        const testsItems = [{ filename: 'test1.json' }, { filename: 'test2.json' }];
        
        const petsIndex = {
            tagName: 'Pets',
            list: vi.fn().mockReturnValue(petsItems)
        };
        const testsIndex = {
            tagName: 'Tests',
            list: vi.fn().mockReturnValue(testsItems)
        };
        
        UnifiedIndex.getTagIndex.mockImplementation((tag) => {
            if (tag === 'Pets') return petsIndex;
            if (tag === 'Tests') return testsIndex;
        });

        const wrapper = mount(HomePage);
        await new Promise(resolve => setTimeout(resolve, 0));

        // Switch to Pets tag
        const pageTags = wrapper.findComponent({ name: 'PageTags' });
        await pageTags.vm.$emit('set-index', 'Pets');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Assert we are on Pets page 1
        expect(wrapper.vm.currentPageNumber).toBe(1);
        
        // Navigate to page 3 in Pets
        const pageNav = wrapper.findComponent({ name: 'PageNavigation' });
        await pageNav.vm.$emit('current-page-change', 1, 3);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(wrapper.vm.currentPageNumber).toBe(3);

        // Switch to Tests tag
        await pageTags.vm.$emit('set-index', 'Tests');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Assert we start on page 1 for Tests
        expect(wrapper.vm.currentPageNumber).toBe(1);

        // Navigate to page 2 in Tests
        await pageNav.vm.$emit('current-page-change', 1, 2);
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(wrapper.vm.currentPageNumber).toBe(2);

        // Switch back to Pets tag
        await pageTags.vm.$emit('set-index', 'Pets');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Assert we restored to page 3
        expect(wrapper.vm.currentPageNumber).toBe(3);
    });

    it('saves the page when an existing tag is added to it', async () => {
        // A page that already has one tag, loaded from the index as the current page
        const page = { filename: 'pet.json', title: 'Fluffy', content: 'Cat', tags: ['Pets'], modifiedAt: '2026-01-01 00:00:00' };
        UnifiedIndex.list.mockReturnValue([page]);

        try {
            const wrapper = mount(HomePage);
            await new Promise(resolve => setTimeout(resolve, 0));

            // Add a tag that already exists on other pages, via the tag picker
            await wrapper.findComponent({ name: 'PageTagPills' }).vm.$emit('add-tag', 'Work');
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(wrapper.vm.currentPage.tags).toEqual(['Pets', 'Work']);
            expect(pageWriter.save).toHaveBeenCalledWith(expect.objectContaining({
                filename: 'pet.json',
                tags: ['Pets', 'Work'],
            }));
        } finally {
            UnifiedIndex.list.mockReturnValue([]);
        }
    });

    it('autosaves a title edit after the debounce delay', async () => {
        const page = { filename: 'pet.json', title: 'Fluffy', content: 'Cat', tags: ['Pets'], modifiedAt: '2026-01-01 00:00:00' };
        UnifiedIndex.list.mockReturnValue([page]);

        try {
            const wrapper = mount(HomePage);
            await new Promise(resolve => setTimeout(resolve, 0));

            vi.useFakeTimers();
            await wrapper.find('.page-layout__title-input').setValue('Fluffy 2');
            await vi.advanceTimersByTimeAsync(2000);

            expect(pageWriter.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fluffy 2' }));
        } finally {
            vi.useRealTimers();
            UnifiedIndex.list.mockReturnValue([]);
        }
    });

    it('saves the page when it is added to favourites', async () => {
        const page = { filename: 'pet.json', title: 'Fluffy', content: 'Cat', tags: ['Pets'], modifiedAt: '2026-01-01 00:00:00' };
        UnifiedIndex.list.mockReturnValue([page]);

        try {
            const wrapper = mount(HomePage);
            await new Promise(resolve => setTimeout(resolve, 0));

            await wrapper.findComponent({ name: 'PageControls' }).vm.$emit('add-to-favourites');
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(wrapper.vm.currentPage.tags).toEqual(['Pets', Constants.FAVOURITE_TAG]);
            expect(pageWriter.save).toHaveBeenCalledWith(expect.objectContaining({
                filename: 'pet.json',
                tags: ['Pets', Constants.FAVOURITE_TAG],
            }));
        } finally {
            UnifiedIndex.list.mockReturnValue([]);
        }
    });
});
