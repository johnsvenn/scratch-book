import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import PageNavigation from '../../../../src/renderer/components/Navigation/PageNavigation.vue';

describe('PageNavigation.vue', () => {
    const defaultProps = {
        currentPageNumber: 1,
        listDataLength: 10,
        canGoNext: true,
    };

    it('renders with correct page information', () => {
        const wrapper = mount(PageNavigation, {
            props: defaultProps,
        });

        const input = wrapper.find('.page-navigation__input');
        expect(input.element.value).toBe('1');
        expect(wrapper.text()).toContain('of 10');
    });

    it('disables "First Page" and "Previous Page" when on page 1', () => {
        const wrapper = mount(PageNavigation, {
            props: { ...defaultProps, currentPageNumber: 1 },
        });

        const firstBtn = wrapper.find('[aria-label="First Page"]');
        const prevBtn = wrapper.find('[aria-label="Previous Page"]');

        expect(firstBtn.attributes('disabled')).toBeDefined();
        expect(prevBtn.attributes('disabled')).toBeDefined();
    });

    it('emits event when "Next Page" is clicked', async () => {
        const wrapper = mount(PageNavigation, {
            props: { ...defaultProps, currentPageNumber: 1 },
        });

        const nextBtn = wrapper.find('[aria-label="Next Page"]');
        await nextBtn.trigger('click');

        expect(wrapper.emitted('currentPageChange')).toBeTruthy();
        expect(wrapper.emitted('currentPageChange')[0]).toEqual([1, 2]);
        expect(wrapper.emitted('update:currentPageNumber')[0]).toEqual([2]);
    });

    it('emits event when "Last Page" is clicked', async () => {
        const wrapper = mount(PageNavigation, {
            props: { ...defaultProps, currentPageNumber: 1, listDataLength: 10 },
        });

        const lastBtn = wrapper.find('[aria-label="Last Page"]');
        await lastBtn.trigger('click');

        expect(wrapper.emitted('currentPageChange')[0]).toEqual([1, 10]);
        expect(wrapper.emitted('update:currentPageNumber')[0]).toEqual([10]);
    });

    it('emits event when page is manually updated', async () => {
        const wrapper = mount(PageNavigation, {
            props: { ...defaultProps, currentPageNumber: 5, listDataLength: 10 },
        });

        const input = wrapper.find('.page-navigation__input');
        await input.setValue(8);
        await input.trigger('change');

        expect(wrapper.emitted('currentPageChange')[0]).toEqual([5, 8]);
    });

    it('handles out of bounds manual updates', async () => {
        const wrapper = mount(PageNavigation, {
            props: { ...defaultProps, currentPageNumber: 5, listDataLength: 10 },
        });

        const input = wrapper.find('.page-navigation__input');

        // Too high
        await input.setValue(15);
        await input.trigger('change');
        expect(wrapper.emitted('currentPageChange')[0]).toEqual([5, 10]);

        // Too low
        await input.setValue(0);
        await input.trigger('change');
        // If current is 5, and we set to 0, it falls back to last value (5) if isNaN or 0
        // Wait, my logic: if (isNaN(num) || num === 0) { navCurrentPageNumber.value = navLastPageNumber.value; return; }
        // So no emit.
        expect(wrapper.emitted('currentPageChange')[1]).toBeUndefined();
    });

    it('syncs with props.currentPageNumber', async () => {
        const wrapper = mount(PageNavigation, {
            props: defaultProps,
        });

        await wrapper.setProps({ currentPageNumber: 3 });
        expect(wrapper.find('.page-navigation__input').element.value).toBe('3');
    });
});
