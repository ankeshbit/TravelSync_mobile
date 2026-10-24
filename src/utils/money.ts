/**
 * Money and amount utilities.
 * Handles parseAmount, settlement filtering, and currency grouping.
 */

export interface SettlementItem {
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  amount: number;
  currency?: string;
}

/**
 * Parse an amount string or number safely.
 * Accepts both ',' and '.' as decimal separators.
 * Rejects non-numeric garbage like '12abc', multiple signs, or negative numbers.
 * Rounds to 2 decimal places.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || isNaN(input) || input < 0) return null;
    return Math.round(input * 100) / 100;
  }

  const str = input.trim();
  if (!str) return null;

  // Reject invalid characters: allow only digits, periods, commas, optional leading +
  if (!/^\+?[0-9.,]+$/.test(str)) {
    return null;
  }

  const sanitized = str.startsWith('+') ? str.slice(1) : str;

  const hasComma = sanitized.includes(',');
  const hasDot = sanitized.includes('.');

  let normalizedStr = sanitized;

  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(',');
    const lastDot = sanitized.lastIndexOf('.');
    if (lastComma > lastDot) {
      // e.g. "1.234,56" -> dot is thousands, comma is decimal
      normalizedStr = sanitized.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. "1,234.56" -> comma is thousands, dot is decimal
      normalizedStr = sanitized.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (sanitized.match(/,/g) || []).length;
    if (commaCount === 1) {
      // e.g. "12,50" -> "12.50"
      normalizedStr = sanitized.replace(',', '.');
    } else {
      // e.g. "1,000,000"
      normalizedStr = sanitized.replace(/,/g, '');
    }
  } else if (hasDot) {
    const dotCount = (sanitized.match(/\./g) || []).length;
    if (dotCount > 1) {
      // e.g. "1.000.000"
      normalizedStr = sanitized.replace(/\./g, '');
    }
  }

  const num = Number(normalizedStr);
  if (!Number.isFinite(num) || isNaN(num) || num < 0) {
    return null;
  }

  return Math.round(num * 100) / 100;
}

/**
 * Filter settlements for the active currency.
 * When s.currency exists, it must match activeCurrency (case-insensitive).
 * When s.currency is missing, it falls back to active currency.
 */
export function filterSettlementsForCurrency<T extends { currency?: string }>(
  settlements: T[] = [],
  activeCurrency: string
): T[] {
  if (!settlements || !Array.isArray(settlements)) return [];
  const target = (activeCurrency || 'USD').toUpperCase();
  return settlements.filter((s) => {
    if (!s) return false;
    const itemCurrency = (s.currency || '').toUpperCase();
    return !itemCurrency || itemCurrency === target;
  });
}

/**
 * Group expenses by currency (uppercase) and compute totals per currency.
 */
export function groupExpensesByCurrency(
  expenses: { amount: number | string; currency?: string }[] = []
): Record<string, number> {
  const totals: Record<string, number> = {};
  if (!expenses || !Array.isArray(expenses)) return totals;
  for (const exp of expenses) {
    const curr = (exp.currency || 'USD').toUpperCase();
    const amt = typeof exp.amount === 'number' ? exp.amount : Number(exp.amount) || 0;
    if (amt > 0) {
      totals[curr] = Math.round(((totals[curr] || 0) + amt) * 100) / 100;
    }
  }
  return totals;
}
