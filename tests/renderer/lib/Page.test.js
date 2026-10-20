import Page from '../../../src/renderer/lib/Pages/Page';

describe('Page Model', () => {
    it('should identify empty pages correctly', () => {
        const emptyCases = [
            new Page({ title: '', content: '' }),
            new Page({ title: '   ', content: '' }),
            new Page({ title: '', content: '   ' }),
            new Page({ title: ' \n ', content: ' \t ' }),
            new Page({ title: null, content: null }),
        ];

        emptyCases.forEach(page => {
            expect(page.isEmpty()).toBe(true);
        });
    });

    it('should identify non-empty pages correctly', () => {
        const nonEmptyCases = [
            new Page({ title: 'Title', content: '' }),
            new Page({ title: '', content: 'Content' }),
            new Page({ title: 'Title', content: 'Content' }),
            new Page({ title: ' . ', content: '' }),
        ];

        nonEmptyCases.forEach(page => {
            expect(page.isEmpty()).toBe(false);
        });
    });
});
