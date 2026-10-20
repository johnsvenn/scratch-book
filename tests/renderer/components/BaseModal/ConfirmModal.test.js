import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ConfirmModal from '../../../../src/renderer/components/BaseModal/ConfirmModal.vue';
import BaseButton from '../../../../src/renderer/components/BaseButton/BaseButton.vue';
import BaseModal from '../../../../src/renderer/components/BaseModal/BaseModal.vue';

describe('ConfirmModal.vue', () => {
    const defaultProps = {
        title: 'Confirm Action',
        message: 'Are you sure you want to do this?'
    };

    it('renders title and message correctly', () => {
        const wrapper = mount(ConfirmModal, {
            props: defaultProps,
            global: {
                components: { BaseModal, BaseButton }
            }
        });

        expect(wrapper.findComponent(BaseModal).props('title')).toBe('Confirm Action');
        expect(wrapper.find('.confirm-modal__content p').text()).toBe('Are you sure you want to do this?');
    });

    it('emits cancel event when cancel button is clicked', async () => {
        const wrapper = mount(ConfirmModal, {
            props: defaultProps,
            global: {
                components: { BaseModal, BaseButton }
            }
        });

        const buttons = wrapper.findAllComponents(BaseButton);
        // First button is Cancel
        await buttons[0].trigger('click');
        expect(wrapper.emitted('cancel')).toBeTruthy();
    });

    it('emits confirm event when confirm button is clicked', async () => {
        const wrapper = mount(ConfirmModal, {
            props: defaultProps,
            global: {
                components: { BaseModal, BaseButton }
            }
        });

        const buttons = wrapper.findAllComponents(BaseButton);
        // Second button is Confirm
        await buttons[1].trigger('click');
        expect(wrapper.emitted('confirm')).toBeTruthy();
    });

    it('renders correct button text from props', () => {
        const wrapper = mount(ConfirmModal, {
            props: {
                ...defaultProps,
                confirmText: 'Yes, Delete',
                cancelText: 'No, Keep'
            },
            global: {
                components: { BaseModal, BaseButton }
            }
        });

        const buttons = wrapper.findAllComponents(BaseButton);
        expect(buttons[0].text()).toBe('No, Keep');
        expect(buttons[1].text()).toBe('Yes, Delete');
    });

    it('sets is-danger on the confirm button', () => {
        const wrapper = mount(ConfirmModal, {
            props: defaultProps,
            global: {
                components: { BaseModal, BaseButton }
            }
        });

        const buttons = wrapper.findAllComponents(BaseButton);
        // Confirm button is the second one
        expect(buttons[1].props('isDanger')).toBe(true);
    });
});
