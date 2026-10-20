import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import PageControls from '../../../../src/renderer/components/Navigation/PageControls.vue';
import Constants from '../../../../src/renderer/lib/constants';

describe('PageControls.vue', () => {
    const defaultProps = {
        isFavourite: false,
        activeTagName: Constants.CURRENT_TAG,
        canCreateNewPage: true,
    };

    it('emits event when Favourite button is clicked', async () => {
        const wrapper = mount(PageControls, {
            props: defaultProps,
        });

        const favBtn = wrapper.find('[aria-label="Favourite"]');
        await favBtn.trigger('click');

        expect(wrapper.emitted('add-to-favourites')).toBeTruthy();
    });

    it('emits event when New button is clicked', async () => {
        const wrapper = mount(PageControls, {
            props: defaultProps,
        });

        const newBtn = wrapper.find('[aria-label="New"]');
        await newBtn.trigger('click');

        expect(wrapper.emitted('create-new-page-file')).toBeTruthy();
    });

    it('disables New button when canCreateNewPage is false', () => {
        const wrapper = mount(PageControls, {
            props: { ...defaultProps, canCreateNewPage: false },
        });

        const newBtn = wrapper.find('[aria-label="New"]');
        expect(newBtn.attributes('disabled')).toBeDefined();
    });

    it('shows Archive button when not in archive', () => {
        const wrapper = mount(PageControls, {
            props: { ...defaultProps, activeTagName: Constants.CURRENT_TAG },
        });

        expect(wrapper.find('[aria-label="Archive"]').exists()).toBe(true);
        expect(wrapper.find('[aria-label="Unarchive"]').exists()).toBe(false);
    });

    it('shows Unarchive button when in archive', () => {
        const wrapper = mount(PageControls, {
            props: { ...defaultProps, activeTagName: Constants.ARCHIVE_TAG },
        });

        expect(wrapper.find('[aria-label="Archive"]').exists()).toBe(false);
        expect(wrapper.find('[aria-label="Unarchive"]').exists()).toBe(true);
    });

    it('disables Favourite button when in archive', () => {
        const wrapper = mount(PageControls, {
            props: { ...defaultProps, activeTagName: Constants.ARCHIVE_TAG },
        });

        const favBtn = wrapper.find('[aria-label="Favourite"]');
        expect(favBtn.attributes('disabled')).toBeDefined();
    });

    it('emits event when Delete button is clicked', async () => {
        const wrapper = mount(PageControls, {
            props: defaultProps,
        });

        const delBtn = wrapper.find('[aria-label="Delete"]');
        await delBtn.trigger('click');

        expect(wrapper.emitted('delete-file')).toBeTruthy();
    });
});
