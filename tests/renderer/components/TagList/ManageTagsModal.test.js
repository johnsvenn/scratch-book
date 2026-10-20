import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import ManageTagsModal from '../../../../src/renderer/components/TagList/ManageTagsModal.vue';
import ConfirmModal from '../../../../src/renderer/components/BaseModal/ConfirmModal.vue';

describe('ManageTagsModal.vue', () => {
    const defaultProps = {
        allTags: [
            { name: 'work', count: 5 },
            { name: 'personal', count: 2 },
        ],
        tagColors: new Map([
            ['work', '#ff0000'],
            ['personal', '#00ff00'],
        ]),
    };

    it('renders list of tags', () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        const rows = wrapper.findAll('.manage-tags__row');
        expect(rows).toHaveLength(2);
        expect(rows[0].text()).toContain('work');
        expect(rows[0].text()).toContain('5 pages');
    });

    it('shows "1 page" in the singular', () => {
        const wrapper = mount(ManageTagsModal, {
            props: {
                allTags: [{ name: 'solo', count: 1 }],
                tagColors: new Map([['solo', '#0000ff']]),
            },
        });

        const row = wrapper.find('.manage-tags__row');
        expect(row.find('.manage-tags__count').text()).toBe('1 page');
    });

    it('shows "0 pages" for unused tags', () => {
        const wrapper = mount(ManageTagsModal, {
            props: {
                allTags: [{ name: 'unused', count: 0 }],
                tagColors: new Map([['unused', '#0000ff']]),
            },
        });

        const row = wrapper.find('.manage-tags__row');
        expect(row.find('.manage-tags__name').text()).toBe('unused');
        expect(row.find('.manage-tags__count').text()).toBe('0 pages');
    });

    it('enters edit mode when edit button is clicked', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.manage-tags__icon-btn')[0].trigger('click'); // Edit 'work'
        
        expect(wrapper.find('.manage-tags__input').exists()).toBe(true);
        expect(wrapper.find('.manage-tags__input').element.value).toBe('work');
        expect(wrapper.find('.manage-tags__palette').exists()).toBe(true);
    });

    it('emits rename-tag and recolor-tag on save', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.manage-tags__icon-btn')[0].trigger('click');
        
        const input = wrapper.find('.manage-tags__input');
        await input.setValue('employment');
        
        // Select a color from palette
        const colors = wrapper.findAll('.manage-tags__color-option');
        await colors[2].trigger('click'); // Click 3rd color
        
        await wrapper.find('.manage-tags__btn--primary').trigger('click'); // Save

        expect(wrapper.emitted('rename-tag')).toBeTruthy();
        expect(wrapper.emitted('rename-tag')[0]).toEqual(['work', 'employment']);
        
        expect(wrapper.emitted('recolor-tag')).toBeTruthy();
    });

    it('asks for confirmation with ConfirmModal before deleting', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.manage-tags__icon-btn--danger')[1].trigger('click'); // Delete 'personal'

        const confirmModal = wrapper.findComponent(ConfirmModal);
        expect(confirmModal.exists()).toBe(true);
        expect(confirmModal.props('message')).toContain('"personal"');
        expect(wrapper.emitted('delete-tag')).toBeFalsy();
    });

    it('emits delete-tag when deletion is confirmed', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.manage-tags__icon-btn--danger')[1].trigger('click'); // Delete 'personal'
        wrapper.findComponent(ConfirmModal).vm.$emit('confirm');
        await nextTick();

        expect(wrapper.emitted('delete-tag')).toBeTruthy();
        expect(wrapper.emitted('delete-tag')[0]).toEqual(['personal']);
        expect(wrapper.findComponent(ConfirmModal).exists()).toBe(false);
    });

    it('does not emit delete-tag when deletion is cancelled', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.findAll('.manage-tags__icon-btn--danger')[1].trigger('click'); // Delete 'personal'
        wrapper.findComponent(ConfirmModal).vm.$emit('cancel');
        await nextTick();

        expect(wrapper.emitted('delete-tag')).toBeFalsy();
        expect(wrapper.findComponent(ConfirmModal).exists()).toBe(false);
    });

    it('emits close when close button is clicked', async () => {
        const wrapper = mount(ManageTagsModal, {
            props: defaultProps,
        });

        await wrapper.find('.base-modal__close').trigger('click');
        expect(wrapper.emitted('close')).toBeTruthy();
    });
});
