import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import BaseButton from '../../../../src/renderer/components/BaseButton/BaseButton.vue';

describe('BaseButton.vue', () => {
    const defaultProps = {
        label: 'Test Button',
    };

    it('renders label prop when slot is empty', () => {
        const wrapper = mount(BaseButton, {
            props: defaultProps,
        });

        expect(wrapper.attributes('aria-label')).toBe('Test Button');
    });

    it('renders slot content when provided', () => {
        const wrapper = mount(BaseButton, {
            props: defaultProps,
            slots: {
                default: 'Click Me',
            },
        });

        expect(wrapper.find('.base-button__label').text()).toBe('Click Me');
    });

    it('renders icon when provided', () => {
        const wrapper = mount(BaseButton, {
            props: { ...defaultProps, icon: 'Plus' },
        });

        expect(wrapper.find('.base-button__icon').exists()).toBe(true);
    });

    it('applies favourite class when isFavourite is true', () => {
        const wrapper = mount(BaseButton, {
            props: { ...defaultProps, isFavourite: true },
        });

        expect(wrapper.classes()).toContain('base-button--favourite');
    });

    it('applies danger class when isDanger is true', () => {
        const wrapper = mount(BaseButton, {
            props: { ...defaultProps, isDanger: true },
        });

        expect(wrapper.classes()).toContain('base-button--danger');
    });

    it('emits click event when clicked', async () => {
        const wrapper = mount(BaseButton, {
            props: defaultProps,
        });

        await wrapper.trigger('click');
        expect(wrapper.emitted('click')).toBeTruthy();
    });
});
