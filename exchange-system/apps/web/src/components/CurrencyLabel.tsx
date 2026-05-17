/**
 * CurrencyLabel — single source of truth for how a currency is displayed
 * across all pages (Currencies, Exchange Rates, Opening Balances, etc.).
 *
 * Format:  🇬🇧  GBP  (British Pound)
 */

/** Convert a 2-letter ISO 3166-1 alpha-2 country code to a flag emoji. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface CurrencyLabelProps {
  code: string;
  nameEn: string;
  countryCode?: string | null;
  /** Controls flag emoji size. Defaults to 'md' (text-lg). Use 'lg' for standalone cells. */
  flagSize?: 'sm' | 'md' | 'lg';
}

export function CurrencyLabel({
  code,
  nameEn,
  countryCode,
  flagSize = 'md',
}: CurrencyLabelProps) {
  const flag = countryFlag(countryCode);
  const flagClass =
    flagSize === 'lg' ? 'text-2xl' : flagSize === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && <span className={flagClass}>{flag}</span>}
      <span className="font-bold">{code}</span>
      <span className="text-gray-500 text-xs">({nameEn})</span>
    </span>
  );
}
