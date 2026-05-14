/**
 * Format numbers using English (ASCII) numerals.
 * Always uses 'en-US' locale to prevent Arabic-Indic numeral rendering
 * when the UI is in Arabic mode.
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(
  value: number | string | null | undefined,
  symbol = '',
  decimals = 2,
): string {
  const formatted = formatNumber(value, decimals);
  if (formatted === '—') return '—';
  return symbol ? `${symbol} ${formatted}` : formatted;
}

export function formatInteger(value: number | string | null | undefined): string {
  return formatNumber(value, 0);
}
