import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';

// Stub the composable so PageTagPills tests are not coupled to its internals
vi.mock('../../../../src/renderer/composables/useTagPillStyle', () => ({
    useTagPillStyle: vi.fn(() => ({
        getTagColor: vi.fn((name) => ({ work: '#ff0000', urgent: '#00ff00' })[name] ?? '#aaa'),
        pillStyle: vi.fn((name) => {
            if (name === 'work') return { backgroundColor: 'rgba(255,0,0,0.1)', borderColor: 'rgba(255,0,0,0.3)', color: 'rgb(215,0,0)' };
            return {};
        }),
    })),
    filterUserTags: vi.fn((tags) => (tags || []).filter(t => !['current','archive','favourite'].includes(t))),
}));

import PageTagPills from '../../../../src/renderer/components/Navigation/PageTagPills.vue';

describe('PageTagPills.vue', () => {
    const defaultProps = {
        tags: ['work', 'urgent'],
        allTags: [{ name: 'work', count: 1 }, { name: 'urgent', count: 1 }, { name: 'personal', count: 0 }],
        tagColors: { work: '#ff0000', urgent: '#00ff00' },
        disabled: false,
    };

    it('renders user tags as pills', () => {
        const wrapper = mount(PageTagPills, { props: defaultProps });

        const pills = wrapper.findAll('.page-tag-pills__pill');
        expect(pills.length).toBe(2);
        expect(pills[0].text()).toContain('work');
        expect(pills[1].text()).toContain('urgent');
    });

    it('filters out reserved tags (current, archive, favourite)', () => {
        const wrapper = mount(PageTagPills, {
            props: {
                ...defaultProps,
                tags: ['work', 'current', 'archive'],
            },
        });

        const pills = wrapper.findAll('.page-tag-pills__pill');
        expect(pills.length).toBe(1);
        expect(pills[0].text()).toContain('work');
    });

    it('emits remove-tag when pill remove button is clicked', async () => {
        const wrapper = mount(PageTagPills, { props: defaultProps });

        const removeBtn = wrapper.find('.page-tag-pills__remove');
        await removeBtn.trigger('click');

        expect(wrapper.emitted('remove-tag')).toBeTruthy();
        expect(wrapper.emitted('remove-tag')[0]).toEqual(['work']);
    });

    it('toggles the AddTagToPageModal when + tag button is clicked', async () => {
        const wrapper = mount(PageTagPills, {
            props: defaultProps,
            global: { stubs: { AddTagToPageModal: true } },
        });

        const addBtn = wrapper.find('.page-tag-pills__add');

        // Open
        await addBtn.trigger('click');
        expect(wrapper.findComponent({ name: 'AddTagToPageModal' }).exists()).toBe(true);

        // Close
        await addBtn.trigger('click');
        expect(wrapper.findComponent({ name: 'AddTagToPageModal' }).exists()).toBe(false);
    });

    it('hides the + tag button and applies disabled pill class when disabled prop is true', () => {
        const wrapper = mount(PageTagPills, {
            props: { ...defaultProps, disabled: true },
        });

        expect(wrapper.find('.page-tag-pills__add').exists()).toBe(false);
        expect(wrapper.find('.page-tag-pills__pill--disabled').exists()).toBe(true);
    });

    it('applies grey disabled styles to pills when disabled is true', () => {
        const wrapper = mount(PageTagPills, {
            props: { ...defaultProps, disabled: true },
        });

        const pill = wrapper.find('.page-tag-pills__pill');
        // The disabled pillStyle returns hardcoded grey inline styles
        expect(pill.attributes('style')).toContain('background-color: rgb(245, 245, 245)');
    });

    it('delegates colour resolution to the useTagPillStyle composable', async () => {
        const { useTagPillStyle } = await import('../../../../src/renderer/composables/useTagPillStyle');
        mount(PageTagPills, { props: defaultProps });
        expect(useTagPillStyle).toHaveBeenCalled();
    });

    it('renders a coloured dot inside each pill', () => {
        const wrapper = mount(PageTagPills, { props: defaultProps });
        const dots = wrapper.findAll('.page-tag-pills__dot');
        expect(dots.length).toBe(2);
    });
});
