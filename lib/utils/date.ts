/**
 * Date utility functions for RuralCred Advisor.
 * Handles conversions between ISO strings (YYYY-MM-DD for <input type="date" />)
 * and human-readable regional formats (DD MMM YYYY, e.g., "20 Sep 2026").
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Returns today's date formatted as YYYY-MM-DD using the local timezone.
 */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date formatted in standard display format (e.g. "20 Sep 2026").
 */
export function getTodayDisplayDate(): string {
  return formatIsoToDisplayDate(getTodayIso());
}

/**
 * Converts a YYYY-MM-DD ISO string into "DD MMM YYYY" (e.g. "2026-09-20" -> "20 Sep 2026").
 */
export function formatIsoToDisplayDate(isoStr: string): string {
  if (!isoStr) return getTodayDisplayDate();
  
  // If it's already in DD MMM YYYY format, return as is
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(isoStr.trim())) {
    return isoStr.trim();
  }

  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (!isNaN(year) && !isNaN(monthIdx) && !isNaN(day) && monthIdx >= 0 && monthIdx < 12) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = MONTH_NAMES[monthIdx];
      return `${dayStr} ${monthStr} ${year}`;
    }
  }

  const d = new Date(isoStr);
  if (!isNaN(d.getTime())) {
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = MONTH_NAMES[d.getMonth()];
    return `${dayStr} ${monthStr} ${d.getFullYear()}`;
  }

  return isoStr;
}

/**
 * Converts a display date (e.g. "20 Sep 2026") or any valid date string into YYYY-MM-DD for <input type="date" />.
 */
export function formatDisplayDateToIso(dateStr: string): string {
  if (!dateStr) return getTodayIso();
  
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Parse "DD MMM YYYY"
  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthStr = match[2].toLowerCase();
    const year = match[3];
    const monthIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthStr);
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return getTodayIso();
}

/**
 * Checks if two date representations refer to the same calendar day.
 */
export function isSameDay(date1: string, date2: string): boolean {
  if (!date1 || !date2) return false;
  return formatDisplayDateToIso(date1) === formatDisplayDateToIso(date2);
}
