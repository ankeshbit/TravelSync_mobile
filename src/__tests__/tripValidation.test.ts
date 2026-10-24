import { parseTripDate, validateTripForm, buildDefaultDates } from '../utils/tripValidation';

describe('parseTripDate', () => {
  it('parses valid date', () => {
    const d = parseTripDate('2024-03-15');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });
  it('rejects invalid month', () => expect(parseTripDate('2024-13-01')).toBeNull());
  it('rejects bad format', () => expect(parseTripDate('15-03-2024')).toBeNull());
  it('rejects null', () => expect(parseTripDate(null)).toBeNull());
});

describe('validateTripForm', () => {
  const valid = {
    name: 'My Trip',
    destination: 'Paris',
    startDate: '2024-06-01',
    endDate: '2024-06-08',
    budget: '5000',
    currency: 'EUR',
  };

  it('allows past dates for logging past or completed trips', () => {
    const pastTrip = {
      name: 'Past Europe Vacation',
      destination: 'Rome, Italy',
      startDate: '2023-05-10',
      endDate: '2023-05-20',
      budget: '3000',
      currency: 'EUR',
    };
    const res = validateTripForm(pastTrip);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('passes valid form', () => expect(validateTripForm(valid).valid).toBe(true));
  it('fails missing name', () => expect(validateTripForm({ ...valid, name: '' }).valid).toBe(false));
  it('fails end before start', () => {
    const r = validateTripForm({ ...valid, startDate: '2024-06-08', endDate: '2024-06-01' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('End date'))).toBe(true);
  });
  it('fails 2-letter currency', () => {
    expect(validateTripForm({ ...valid, currency: 'EU' }).valid).toBe(false);
  });
  it('fails negative budget', () => {
    expect(validateTripForm({ ...valid, budget: '-100' }).valid).toBe(false);
  });
});

describe('buildDefaultDates', () => {
  it('returns YYYY-MM-DD format', () => {
    const { startDate, endDate } = buildDefaultDates();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('end is after start', () => {
    const { startDate, endDate } = buildDefaultDates();
    expect(endDate > startDate).toBe(true);
  });
});
