import Datetime, { getOrdinalSuffix, formatDate } from '../../../src/renderer/lib/DatetimeFunctions';

describe('DatetimeFunctions', () => {
    describe('Datetime class', () => {
        it('instantiates with current date and returns ISO string', () => {
            const dt = new Datetime();
            expect(dt.now).toBeInstanceOf(Date);
            const isoString = dt.getDateTimeString();
            expect(typeof isoString).toBe('string');
            expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('getOrdinalSuffix', () => {
        it('returns st for 1, 21, 31', () => {
            expect(getOrdinalSuffix(1)).toBe('st');
            expect(getOrdinalSuffix(21)).toBe('st');
            expect(getOrdinalSuffix(31)).toBe('st');
        });

        it('returns nd for 2, 22', () => {
            expect(getOrdinalSuffix(2)).toBe('nd');
            expect(getOrdinalSuffix(22)).toBe('nd');
        });

        it('returns rd for 3, 23', () => {
            expect(getOrdinalSuffix(3)).toBe('rd');
            expect(getOrdinalSuffix(23)).toBe('rd');
        });

        it('returns th for 4-20, exceptions like 11, 12, 13', () => {
            expect(getOrdinalSuffix(4)).toBe('th');
            expect(getOrdinalSuffix(11)).toBe('th');
            expect(getOrdinalSuffix(12)).toBe('th');
            expect(getOrdinalSuffix(13)).toBe('th');
            expect(getOrdinalSuffix(20)).toBe('th');
            expect(getOrdinalSuffix(30)).toBe('th');
        });
    });

    describe('formatDate', () => {
        it('formats a valid date string correctly', () => {
            // Using a fixed date "2023-05-12T15:30:00.000Z"
            // To prevent timezone issues during test, we mock toLocaleString if needed,
            // or just regex check the output format.
            const dateStr = '2023-05-12T15:30:00.000Z';
            const formatted = formatDate(dateStr);
            
            // Should contain "12th May 2023" for a typical environment.
            // Since tests run in different TZ, the day/hour might differ slightly.
            // But we know it's a string containing "May" and "2023".
            expect(typeof formatted).toBe('string');
            expect(formatted.includes('2023')).toBe(true);
            expect(formatted).toMatch(/\d{1,2}(st|nd|rd|th)/); // day with ordinal
        });

        it('returns empty string if value is falsy', () => {
            expect(formatDate(null)).toBe('');
            expect(formatDate(undefined)).toBe('');
            expect(formatDate('')).toBe('');
        });
    });
});
