import { parseCalendarDate, calculateTripDays, formatDate } from '../utils/dateUtils';

describe('parseCalendarDate', () => {
  it('parses YYYY-MM-DD without UTC shift', () => {
    const d = parseCalendarDate('2024-01-15');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getFullYear()).toBe(2024);
  });
  it('returns null for empty string', () => expect(parseCalendarDate('')).toBeNull());
  it('returns null for null', () => expect(parseCalendarDate(null)).toBeNull());
});

describe('calculateTripDays', () => {
  it('same day = 1', () => expect(calculateTripDays('2024-01-10', '2024-01-10')).toBe(1));
  it('consecutive = 2', () => expect(calculateTripDays('2024-01-10', '2024-01-11')).toBe(2));
  it('one week = 8 (inclusive)', () => expect(calculateTripDays('2024-01-10', '2024-01-17')).toBe(8));
  it('returns at least 1 for null', () => expect(calculateTripDays(null, null)).toBe(1));
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2024-06-15');
    expect(result).toContain('2024');
    expect(result).toContain('Jun');
  });
  it('returns empty for null', () => expect(formatDate(null)).toBe(''));
});
