/**
 * Deterministic number formatters that produce identical output on both
 * Node.js (SSR) and the browser, avoiding Next.js hydration mismatches
 * caused by Intl/toLocaleString locale differences between environments.
 */

/**
 * Formats a number as BRL currency.
 * e.g. 1234.5 → "R$ 1.234,50"
 */
export function formatBRL(value: number): string {
  const [intPart, decPart = "00"] = value.toFixed(2).split(".");
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${intFormatted},${decPart}`;
}

/**
 * Formats a large number in compact pt-BR notation.
 * e.g. 1_500_000 → "1,5M" | 2_300 → "2,3K"
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  }
  return String(value);
}
