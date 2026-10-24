/**
 * Trip form validation utilities.
 * All date parsing is timezone-safe (YYYY-MM-DD → local calendar date, no UTC shift).
 */

export interface TripFormData {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string | number;
  currency?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Strictly parse YYYY-MM-DD into a local Date.
 * Returns null if invalid.
 */
export function parseTripDate(str?: string | null): Date | null {
  if (!str) return null;
  const m = String(str).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Build default start/end dates from current local calendar date.
 * Avoids UTC shift that happens with new Date().toISOString().
 */
export function buildDefaultDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: fmt(now), endDate: fmt(nextWeek) };
}

/**
 * Convert a YYYY-MM-DD string to ISO 8601 string without UTC shift.
 */
export function dateStringToISO(dateStr: string): string {
  const d = parseTripDate(dateStr);
  if (!d) throw new Error(`Invalid date: ${dateStr}`);
  // Use noon local time to avoid cross-timezone date shifts
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
}

/**
 * Validate trip form data and return errors.
 */
export function validateTripForm(data: TripFormData): ValidationResult {
  const errors: string[] = [];

  if (!data.name?.trim()) {
    errors.push('Trip name is required.');
  }
  if (!data.destination?.trim()) {
    errors.push('Destination is required.');
  }

  const startDate = parseTripDate(data.startDate);
  const endDate = parseTripDate(data.endDate);

  if (!data.startDate || !startDate) {
    errors.push('Start date must be in YYYY-MM-DD format.');
  }
  if (!data.endDate || !endDate) {
    errors.push('End date must be in YYYY-MM-DD format.');
  }
  if (startDate && endDate && endDate < startDate) {
    errors.push('End date must be on or after start date.');
  }

  const budgetNum = typeof data.budget === 'number' ? data.budget : parseFloat(String(data.budget || '0'));
  if (data.budget !== undefined && data.budget !== '' && (isNaN(budgetNum) || budgetNum < 0)) {
    errors.push('Budget must be a non-negative number.');
  }

  if (data.currency !== undefined) {
    const curr = String(data.currency).trim();
    if (!/^[A-Za-z]{3}$/.test(curr)) {
      errors.push('Currency must be a 3-letter code (e.g. USD, EUR, INR).');
    }
  }

  return { valid: errors.length === 0, errors };
}
