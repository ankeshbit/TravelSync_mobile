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
 * Supports standard Western and Indian thousands group separators.
 * Rejects malformed values (e.g. '1,2,3', '1.2.3', '12..50', 'abc123', '--100').
 * Rejects negative numbers, multiple signs, non-numeric garbage, and empty strings.
 * Rounds to 2 decimal places.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || Number.isNaN(input) || input < 0) return null;
    return Math.round(input * 100) / 100;
  }

  if (typeof input !== 'string') return null;

  const raw = input.trim();
  if (!raw) return null;

  // Reject negative numbers or multiple signs
  if (raw.startsWith('-') || /^[+-]{2,}/.test(raw)) return null;

  // Optional single leading +
  const str = raw.startsWith('+') ? raw.slice(1).trim() : raw;
  if (!str) return null;

  // Must only contain digits, commas, periods
  if (!/^[0-9.,]+$/.test(str)) return null;

  // Reject consecutive separators like '..', ',,', '.,', ',.'
  if (/[.,]{2,}/.test(str)) return null;

  // Reject leading or trailing separator like '.5', '5.', ',5', '5,'
  if (/^[.,]|[.,]$/.test(str)) return null;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  let normalizedStr: string | null = null;

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma < lastDot) {
      // Format: thousands comma, decimal dot: e.g. "1,000.50", "1,00,000.50"
      // Verify all commas are strictly before the dot
      if (str.indexOf(',', lastDot) !== -1) return null;

      const intPart = str.slice(0, lastDot);
      const decPart = str.slice(lastDot + 1);

      if (!/^\d+$/.test(decPart)) return null;

      // Validate thousands grouping for intPart:
      // Valid Western: e.g. 1,000 or 1,000,000
      // Valid Indian: e.g. 1,00,000 or 10,00,000
      const isWestern = /^\d{1,3}(?:,\d{3})+$/.test(intPart);
      const isIndian = /^\d{1,3}(?:,\d{2})*,\d{3}$/.test(intPart);

      if (!isWestern && !isIndian) return null;

      normalizedStr = intPart.replace(/,/g, '') + '.' + decPart;
    } else {
      // Format: thousands dot, decimal comma: e.g. "1.000,50", "1.000.000,50"
      // Verify all dots are strictly before the comma
      if (str.indexOf('.', lastComma) !== -1) return null;

      const intPart = str.slice(0, lastComma);
      const decPart = str.slice(lastComma + 1);

      if (!/^\d+$/.test(decPart)) return null;

      // Validate European thousands grouping: e.g. 1.000 or 1.000.000
      if (!/^\d{1,3}(?:\.\d{3})+$/.test(intPart)) return null;

      normalizedStr = intPart.replace(/\./g, '') + '.' + decPart;
    }
  } else if (hasComma) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount === 1) {
      // Could be European decimal e.g. "12,50" or Western thousands without decimal e.g. "1,000"
      if (/^\d+,\d{1,2}$/.test(str)) {
        // European decimal: e.g. "12,50" -> 12.50
        normalizedStr = str.replace(',', '.');
      } else if (/^\d{1,3},\d{3}$/.test(str)) {
        // Standard thousands integer: e.g. "1,000" or "12,500"
        normalizedStr = str.replace(',', '');
      } else {
        return null;
      }
    } else {
      // Multiple commas -> thousands separators: e.g. "1,000,000" or "1,00,000"
      const isWestern = /^\d{1,3}(?:,\d{3})+$/.test(str);
      const isIndian = /^\d{1,3}(?:,\d{2})*,\d{3}$/.test(str);
      if (!isWestern && !isIndian) return null;

      normalizedStr = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount === 1) {
      // Standard decimal e.g. "100.50", "12.5", "1.999"
      if (/^\d+\.\d+$/.test(str)) {
        normalizedStr = str;
      } else {
        return null;
      }
    } else {
      // Multiple dots -> European thousands separators e.g. "1.000.000"
      if (/^\d{1,3}(?:\.\d{3})+$/.test(str)) {
        normalizedStr = str.replace(/\./g, '');
      } else {
        return null;
      }
    }
  } else {
    // Pure digits
    if (/^\d+$/.test(str)) {
      normalizedStr = str;
    } else {
      return null;
    }
  }

  if (normalizedStr === null) return null;

  const num = Number(normalizedStr);
  if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
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
