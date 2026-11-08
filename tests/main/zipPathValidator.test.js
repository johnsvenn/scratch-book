import { describe, it, expect } from 'vitest';
import { findBadPaths } from '../../src/main/zipPathValidator';

const ROOT = '/home/user/.scratchbook.import';

describe('findBadPaths', () => {
    it('returns an empty list for ordinary entry names', () => {
        expect(findBadPaths(['index.md', 'page/index.md', 'tags/work.json'], ROOT)).toEqual([]);
    });

    it('flags entries that climb out of the root with ..', () => {
        expect(findBadPaths(['../escape.txt', 'ok.md'], ROOT)).toEqual(['../escape.txt']);
    });

    it('flags entries that climb out after nested segments', () => {
        expect(findBadPaths(['a/../../escape.txt'], ROOT)).toEqual(['a/../../escape.txt']);
    });

    it('flags absolute entry names', () => {
        expect(findBadPaths(['/etc/passwd'], ROOT)).toEqual(['/etc/passwd']);
    });

    it('allows names that start with .. but stay inside the root', () => {
        expect(findBadPaths(['..notes/x.md'], ROOT)).toEqual([]);
    });

    it('allows a name that goes up and back down inside the root', () => {
        expect(findBadPaths(['a/../b.md'], ROOT)).toEqual([]);
    });

    it('flags the bare parent directory', () => {
        expect(findBadPaths(['..'], ROOT)).toEqual(['..']);
    });
});
