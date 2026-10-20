import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import TagListModal from '../../../../src/renderer/components/TagList/TagListModal.vue';

// Mock vuedraggable since it's a complex component
vi.mock('vuedraggable', () => ({
    default: {
        template: '<div><slot name="item" v-for="item in modelValue" :element="item"></slot></div>',
        props: ['modelValue']
    }
}));

describe('TagListModal.vue', () => {
    const defaultProps = {
        title: 'Work Pages',
        items: [
            { filename: 'page1.json', title: 'Page 1', content: 'content 1', createdAt: new Date() },
            { filename: 'page2.json', title: 'Page 2', content: 'content 2', createdAt: new Date() },
            { filename: 'empty.json', title: '', content: '', createdAt: new Date() }, // Should be filtered
        ],
    };

    it('renders transformed titles', async () => {
        const wrapper = mount(TagListModal, {
            props: { ...defaultProps, title: 'favourite' },
        });
        expect(wrapper.find('.base-modal__title').text()).toBe('Favourites');

        await wrapper.setProps({ title: 'archive' });
        expect(wrapper.find('.base-modal__title').text()).toBe('Archive');

        await wrapper.setProps({ title: 'current' });
        expect(wrapper.find('.base-modal__title').text()).toBe('All Pages');

        await wrapper.setProps({ title: 'Work' });
        expect(wrapper.find('.base-modal__title').text()).toBe('Work');
    });

    it('renders filtered list of items', () => {
        const wrapper = mount(TagListModal, {
            props: defaultProps,
        });

        const items = wrapper.findAll('.tag-list__list-item');
        expect(items).toHaveLength(2);
        expect(items[0].text()).toContain('Page 1');
        expect(items[1].text()).toContain('Page 2');
    });

    it('emits navigateTo when an item is clicked', async () => {
        const wrapper = mount(TagListModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.tag-list__list-item')[0].trigger('click');

        expect(wrapper.emitted('navigateTo')).toBeTruthy();
        expect(wrapper.emitted('navigateTo')[0]).toEqual(['page1.json']);
    });

    it('emits close-tag-list when close button is clicked', async () => {
        const wrapper = mount(TagListModal, {
            props: defaultProps,
        });

        await wrapper.find('.base-modal__close').trigger('click');
        expect(wrapper.emitted('close-tag-list')).toBeTruthy();
    });
});
