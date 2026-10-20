import fileFormatter from '../../../src/renderer/lib/fileFormatter';

describe('fileFormatter', () => {
    describe('prepareItem', () => {
        it('formats item cleanly with metadata and content', () => {
            const item = {
                title: 'My Title',
                content: 'My content body',
            };
            const expected = JSON.stringify({ title: 'My Title' }, null, '    ') + '\n++++++++++\n' + 'My content body';
            expect(fileFormatter.prepareItem(item)).toBe(expected);
        });

        it('handles items with no content', () => {
            const item = {
                title: 'My Title',
            };
            const expected = JSON.stringify({ title: 'My Title' }, null, '    ') + '\n++++++++++\n';
            expect(fileFormatter.prepareItem(item)).toBe(expected);
        });
    });

    describe('extract', () => {
        it('extracts valid formatted data', () => {
            const fileData = JSON.stringify({ title: 'My Title' }, null, '    ') + '\n++++++++++\n' + 'My content body';
            const [metaData, content] = fileFormatter.extract(fileData);
            expect(metaData).toEqual({ title: 'My Title' });
            expect(content).toBe('My content body');
        });

        it('handles falsy fileData by returning default empty values', () => {
            // This covers line 36
            expect(fileFormatter.extract(null)).toEqual([{}, '']);
            expect(fileFormatter.extract(undefined)).toEqual([{}, '']);
            expect(fileFormatter.extract('')).toEqual([{}, '']);
        });

        it('handles malformed fileData when metadata JSON parsing fails', () => {
            const fileData = 'Not JSON\n++++++++++\nMy content body';
            const [metaData, content] = fileFormatter.extract(fileData);
            expect(metaData).toBeNull();
            expect(content).toBe('My content body');
        });

        it('handles truthy fileData that toStrings to empty string (line 20 branch)', () => {
            const fileData = { toString: () => '' };
            const [metaData, content] = fileFormatter.extract(fileData);
            expect(metaData).toEqual({});
            expect(content).toBe('');
        });
    });
});
