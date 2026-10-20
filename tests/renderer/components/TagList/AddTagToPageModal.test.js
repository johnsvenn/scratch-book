import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import AddTagToPageModal from '../../../../src/renderer/components/TagList/AddTagToPageModal.vue';

describe('AddTagToPageModal.vue', () => {
    const defaultProps = {
        pageTags: ['work'],
        allTags: [
            { name: 'work', count: 1 },
            { name: 'personal', count: 0 },
        ],
        tagColors: new Map([
            ['work', '#ff0000'],
            ['personal', '#00ff00'],
        ]),
    };

    it('renders inside a BaseModal titled "Tags for this page"', () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        expect(wrapper.find('.base-modal').exists()).toBe(true);
        expect(wrapper.find('.base-modal__title').text()).toBe('Tags for this page');
    });

    it('renders existing tags from allTags', () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        const pills = wrapper.findAll('.add-tag-modal__pill');
        expect(pills).toHaveLength(2);
        expect(pills[0].text()).toContain('work');
        expect(pills[1].text()).toContain('personal');
    });

    it('marks tags present in pageTags as active', () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        const workPill = wrapper.findAll('.add-tag-modal__pill')[0];
        const personalPill = wrapper.findAll('.add-tag-modal__pill')[1];

        expect(workPill.classes()).toContain('add-tag-modal__pill--active');
        expect(personalPill.classes()).not.toContain('add-tag-modal__pill--active');
    });

    it('emits toggle-tag when a tag pill is clicked', async () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        const personalPill = wrapper.findAll('.add-tag-modal__pill')[1];
        await personalPill.trigger('click');

        expect(wrapper.emitted('toggle-tag')).toBeTruthy();
        expect(wrapper.emitted('toggle-tag')[0]).toEqual(['personal', true]);
    });

    it('emits close when the BaseModal close button is clicked', async () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        await wrapper.find('.base-modal__close').trigger('click');
        expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('enables add button only for valid new tags', async () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        const input = wrapper.find('.add-tag-modal__input');
        const submitBtn = wrapper.find('.add-tag-modal__submit');

        expect(submitBtn.element.disabled).toBe(true);

        await input.setValue('work'); // Already exists
        expect(submitBtn.element.disabled).toBe(true);

        await input.setValue('urgent'); // New
        expect(submitBtn.element.disabled).toBe(false);
    });

    it('emits add-new-tag when form is submitted', async () => {
        const wrapper = mount(AddTagToPageModal, {
            props: defaultProps,
        });

        const input = wrapper.find('.add-tag-modal__input');
        await input.setValue('urgent');
        await wrapper.find('.add-tag-modal__form').trigger('submit');

        expect(wrapper.emitted('add-new-tag')).toBeTruthy();
        expect(wrapper.emitted('add-new-tag')[0]).toEqual(['urgent']);
    });
});
