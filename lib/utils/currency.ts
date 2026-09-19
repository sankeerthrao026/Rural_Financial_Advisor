/**
 * Formats a numeric value into the standard Indian numbering currency format (e.g. ₹9,00,000).
 * Never formats as Western millions/billions (e.g. ₹900,000).
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.round(Math.abs(amount));

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(absAmount);

  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Formats a number with Indian numbering without the currency symbol.
 */
export function formatIndianNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

/**
 * Parses user input strings into a clean numeric rupee value.
 * Handles inputs like "₹ 1,50,000", "50k", "2.5 lakh", etc.
 */
export function parseINR(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;

  const clean = value.toLowerCase().trim().replace(/[₹,\s]/g, '');
  
  if (clean.endsWith('lakh') || clean.endsWith('lac') || clean.endsWith('l')) {
    const num = parseFloat(clean.replace(/(lakh|lac|l)/, ''));
    return isNaN(num) ? 0 : Math.round(num * 100000);
  }

  if (clean.endsWith('cr') || clean.endsWith('crore')) {
    const num = parseFloat(clean.replace(/(cr|crore)/, ''));
    return isNaN(num) ? 0 : Math.round(num * 10000000);
  }

  if (clean.endsWith('k')) {
    const num = parseFloat(clean.replace('k', ''));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}
