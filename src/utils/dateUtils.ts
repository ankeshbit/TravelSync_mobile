/**
 * Safe calendar date utilities that prevent off-by-one timezone shifting.
 */

export function parseCalendarDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const match = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  return new Date(year, month, day);
}

export function formatDate(dateStr?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '';
  const d = parseCalendarDate(dateStr);
  if (!d) return String(dateStr);
  return d.toLocaleDateString(undefined, options || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return '';
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

export function calculateTripDays(startDate?: string | null, endDate?: string | null): number {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  if (!start || !end) return 1;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1); // Inclusive of both start and end day
}
