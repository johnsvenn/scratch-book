import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import PageTags from '../../../../src/renderer/components/Navigation/PageTags.vue';
import Constants from '../../../../src/renderer/lib/constants';

describe('PageTags.vue', () => {
    const defaultProps = {
        activeTagName: Constants.CURRENT_TAG,
        userTags: [
            { name: 'work', count: 5 },
            { name: 'personal', count: 3 },
            { name: 'urgent', count: 2 },
            { name: 'ideas', count: 1 },
            { name: 'archive', count: 10 } // Should be filtered if not in fixedTabs
        ],
        tagColors: { work: '#ff0000', personal: '#00ff00' },
        hasFavourites: true,
        maxVisibleTags: 2,
    };

    it('renders fixed tabs and visible user tags', () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        const tabs = wrapper.findAll('.tab-bar__tab');
        // 1 fixed tab (All Pages) + 2 visible user tags + 1 Archive + 1 More = 5
        expect(tabs.length).toBe(5);
        expect(tabs[0].text()).toContain('All Pages');
        expect(tabs[1].text()).toContain('work');
        expect(tabs[2].text()).toContain('personal');
    });

    it('emits show-favourites when heart icon is clicked', async () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        const favBtn = wrapper.find('.tab-bar__icon-btn--favourite');
        await favBtn.trigger('click');

        expect(wrapper.emitted('show-favourites')).toBeTruthy();
    });

    it('emits set-index when a tab is clicked', async () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        const tabs = wrapper.findAll('.tab-bar__tab');
        await tabs[1].trigger('click'); // 'work' tab

        expect(wrapper.emitted('set-index')).toBeTruthy();
        expect(wrapper.emitted('set-index')[0]).toEqual(['work']);
    });

    it('shows overflow dropdown when there are more tags', async () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        const moreBtn = wrapper.find('.tab-bar__tab--more');
        expect(moreBtn.exists()).toBe(true);

        await moreBtn.trigger('click');
        const dropdownItems = wrapper.findAll('.tab-bar__dropdown-item');
        // userTags has 5 items. maxVisibleTags is 2. So 3 should be in overflow.
        // Wait, userTags: [work, personal, urgent, ideas, archive]
        // indices 0, 1 are visible. 2, 3, 4 are overflow.
        // So 3 items + 1 "+ new tag" item = 4
        expect(dropdownItems.length).toBe(4);
        expect(dropdownItems[0].text()).toContain('urgent');
    });

    it('emits set-index when an overflow tag is clicked', async () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        await wrapper.find('.tab-bar__tab--more').trigger('click');
        const dropdownItems = wrapper.findAll('.tab-bar__dropdown-item');
        await dropdownItems[0].trigger('click'); // 'urgent'

        expect(wrapper.emitted('set-index')).toBeTruthy();
        expect(wrapper.emitted('set-index')[0]).toEqual(['urgent']);
        // Check if dropdown closed
        expect(wrapper.find('.tab-bar__dropdown').exists()).toBe(false);
    });

    it('emits create-new-tag when "+ new tag" is clicked', async () => {
        const wrapper = mount(PageTags, {
            props: defaultProps,
        });

        await wrapper.find('.tab-bar__tab--more').trigger('click');
        const newItem = wrapper.find('.tab-bar__dropdown-item--new');
        await newItem.trigger('click');

        expect(wrapper.emitted('create-new-tag')).toBeTruthy();
    });
});
