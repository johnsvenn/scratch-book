import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import MarkdownRenderer from '../../../src/renderer/components/MarkdownRenderer.vue';

describe('MarkdownRenderer.vue', () => {
    it('sanitizes potentially unsafe HTML from markdown', () => {
        const wrapper = mount(MarkdownRenderer, {
            props: {
                content: '# Header\n\n<img src=x onerror="alert(1)"><script>alert(2)</script>',
            },
        });

        const html = wrapper.html();
        expect(html).toContain('Header');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('onerror=');
    });
});
