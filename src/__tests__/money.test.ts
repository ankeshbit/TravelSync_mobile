import { parseAmount, filterSettlementsForCurrency } from '../utils/money';

describe('parseAmount', () => {
  it('accepts integer', () => expect(parseAmount(42)).toBe(42));
  it('rounds to 2 decimals', () => expect(parseAmount('1.999')).toBe(2));
  it('accepts comma decimal', () => expect(parseAmount('12,50')).toBe(12.5));
  it('accepts dot decimal', () => expect(parseAmount('12.50')).toBe(12.5));
  it('accepts thousand separator comma', () => expect(parseAmount('1,000.50')).toBe(1000.5));
  it('accepts thousand separator dot', () => expect(parseAmount('1.000,50')).toBe(1000.5));
  it('rejects garbage string', () => expect(parseAmount('12abc')).toBeNull());
  it('rejects negative', () => expect(parseAmount('-5')).toBeNull());
  it('rejects null', () => expect(parseAmount(null)).toBeNull());
  it('rejects empty string', () => expect(parseAmount('')).toBeNull());
  it('rejects NaN', () => expect(parseAmount(NaN)).toBeNull());
  it('accepts 0', () => expect(parseAmount(0)).toBe(0));
});

describe('filterSettlementsForCurrency', () => {
  const settlements = [
    { from: 'a', to: 'b', amount: 100, currency: 'USD' },
    { from: 'b', to: 'c', amount: 50, currency: 'INR' },
    { from: 'c', to: 'a', amount: 20 },
  ];
  it('filters by currency', () => {
    const result = filterSettlementsForCurrency(settlements, 'USD');
    expect(result).toHaveLength(2); // USD + no-currency fallback
  });
  it('returns all with no-currency when filtering INR', () => {
    const result = filterSettlementsForCurrency(settlements, 'INR');
    expect(result).toHaveLength(2); // INR + no-currency
  });
  it('handles empty', () => expect(filterSettlementsForCurrency([], 'USD')).toEqual([]));
});
