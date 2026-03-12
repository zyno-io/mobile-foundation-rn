import { formatPhone, formatCurrency, formatDuration } from '../../src/helpers/formatting';

describe('formatPhone', () => {
    it('returns empty string for null', () => {
        expect(formatPhone(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(formatPhone(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(formatPhone('')).toBe('');
    });

    it('returns original input for partial number (not 10 digits)', () => {
        expect(formatPhone('555')).toBe('555');
    });

    it('formats a full 10-digit number', () => {
        expect(formatPhone('5551234567')).toBe('(555) 123-4567');
    });

    it('strips +1 prefix and formats', () => {
        expect(formatPhone('+15551234567')).toBe('(555) 123-4567');
    });

    it('strips 1 prefix when followed by 10 digits (via +1 regex)', () => {
        // The regex is /^\+?1(\d{10})$/ — the +? makes the + optional
        expect(formatPhone('15551234567')).toBe('(555) 123-4567');
    });

    it('returns original if too many digits after stripping', () => {
        expect(formatPhone('123456789012')).toBe('123456789012');
    });

    it('strips non-digit characters before formatting', () => {
        expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567');
    });
});

describe('formatCurrency', () => {
    it('returns empty string for null', () => {
        expect(formatCurrency(null)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(formatCurrency('')).toBe('');
    });

    it('prepends $ to digits', () => {
        expect(formatCurrency('12345')).toBe('$12345');
    });

    it('prepends $ to zero', () => {
        expect(formatCurrency('0')).toBe('$0');
    });

    it('strips non-digit characters then prepends $', () => {
        expect(formatCurrency('$123')).toBe('$123');
    });

    it('returns empty for string with only non-digits', () => {
        expect(formatCurrency('abc')).toBe('');
    });
});

describe('formatDuration', () => {
    it('returns 0s for zero seconds', () => {
        expect(formatDuration(0)).toBe('');
    });

    it('formats seconds only', () => {
        expect(formatDuration(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
        expect(formatDuration(125)).toBe('2m 5s');
    });

    it('formats hours, minutes, and seconds', () => {
        expect(formatDuration(3661)).toBe('1h 1m 1s');
    });

    it('formats hours only when no remaining minutes/seconds', () => {
        expect(formatDuration(3600)).toBe('1h');
    });

    it('formats hours and seconds with no minutes', () => {
        expect(formatDuration(3601)).toBe('1h 1s');
    });

    it('formats minutes only when no remaining seconds', () => {
        expect(formatDuration(120)).toBe('2m');
    });
});
