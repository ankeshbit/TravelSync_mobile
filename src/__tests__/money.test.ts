import { parseAmount, filterSettlementsForCurrency } from '../utils/money';

describe('parseAmount', () => {
  it('accepts integer', () => expect(parseAmount(42)).toBe(42));
  it('rounds to 2 decimals', () => expect(parseAmount('1.999')).toBe(2));
  it('accepts comma decimal', () => expect(parseAmount('12,50')).toBe(12.5));
  it('accepts dot decimal', () => expect(parseAmount('12.50')).toBe(12.5));
  it('accepts thousand separator comma', () => expect(parseAmount('1,000.50')).toBe(1000.5));
  it('accepts thousands without decimal', () => expect(parseAmount('12,500')).toBe(12500));
  it('accepts thousand separator dot', () => expect(parseAmount('1.000,50')).toBe(1000.5));
  it('accepts Indian numbering format (lakhs)', () => expect(parseAmount('1,00,000')).toBe(100000));
  it('accepts Indian numbering format with decimal', () => expect(parseAmount('1,00,000.50')).toBe(100000.5));
  it('accepts European millions format', () => expect(parseAmount('1.000.000,50')).toBe(1000000.5));
  it('accepts leading + sign', () => expect(parseAmount('+150.75')).toBe(150.75));
  it('rejects garbage string', () => expect(parseAmount('12abc')).toBeNull());
  it('rejects negative', () => expect(parseAmount('-5')).toBeNull());
  it('rejects null', () => expect(parseAmount(null)).toBeNull());
  it('rejects empty string', () => expect(parseAmount('')).toBeNull());
  it('rejects whitespace only', () => expect(parseAmount('   ')).toBeNull());
  it('rejects NaN', () => expect(parseAmount(NaN)).toBeNull());
  it('rejects Infinity', () => expect(parseAmount(Infinity)).toBeNull());
  it('rejects -Infinity', () => expect(parseAmount(-Infinity)).toBeNull());
  it('accepts 0', () => expect(parseAmount(0)).toBe(0));
  it('accepts string "0"', () => expect(parseAmount('0')).toBe(0));

  // Explicit regressions for Issue 2
  it('rejects malformed "1,2,3"', () => expect(parseAmount('1,2,3')).toBeNull());
  it('rejects malformed "1.2.3"', () => expect(parseAmount('1.2.3')).toBeNull());
  it('rejects malformed "12..50"', () => expect(parseAmount('12..50')).toBeNull());
  it('rejects malformed "abc123"', () => expect(parseAmount('abc123')).toBeNull());
  it('rejects malformed "--100"', () => expect(parseAmount('--100')).toBeNull());
  it('rejects malformed "++100"', () => expect(parseAmount('++100')).toBeNull());
  it('rejects malformed "1,2.3"', () => expect(parseAmount('1,2.3')).toBeNull());
  it('rejects malformed "1.2,3"', () => expect(parseAmount('1.2,3')).toBeNull());
  it('rejects malformed "1,000.50.50"', () => expect(parseAmount('1,000.50.50')).toBeNull());
  it('rejects malformed "1,000,00"', () => expect(parseAmount('1,000,00')).toBeNull());
  it('rejects leading dot ".50"', () => expect(parseAmount('.50')).toBeNull());
  it('rejects trailing dot "50."', () => expect(parseAmount('50.')).toBeNull());
  it('rejects leading comma ",50"', () => expect(parseAmount(',50')).toBeNull());
  it('rejects trailing comma "50,"', () => expect(parseAmount('50,')).toBeNull());

  // Half-cent decimal-safe rounding and upper bound
  it('rounds half-cents safely without floating point truncation (1.005 -> 1.01)', () => {
    expect(parseAmount(1.005)).toBe(1.01);
    expect(parseAmount('1.005')).toBe(1.01);
    expect(parseAmount(1.004)).toBe(1);
    expect(parseAmount('1.004')).toBe(1);
  });

  it('enforces upper bound on parseAmount', () => {
    expect(parseAmount(1_000_000_000)).toBe(1000000000);
    expect(parseAmount(1_000_000_001)).toBeNull();
    expect(parseAmount('1,000,000,000')).toBe(1000000000);
    expect(parseAmount('1,000,000,001')).toBeNull();
  });
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
