/**
 * Exact rate handling for the tax module (contracts/tax-client.md §1;
 * research.md §1).
 *
 * A rate is an exact decimal STRING end to end: validated here, canonicalised
 * to exactly four decimals, sent to the RPC as a string, and rendered for
 * display only. NO arithmetic is performed on rates in application code — the
 * engine multiplies in SQL `numeric`, which is exact, and each result line is
 * rounded once server-side. A value with more than four decimals is rejected,
 * never rounded, by BOTH this module and the database.
 */

/** The accepted input shape: one or two integer digits, up to four decimals — plus the 100 boundary with zero-or-more trailing zeros. */
export const RATE_PATTERN = /^(100(\.0{1,4})?|\d{1,2}(\.\d{1,4})?)$/

/** Shown next to a rejected rate field. */
export const RATE_HINT =
  'Enter a percentage between 0 and 100 with at most four decimal places, like 8.25.'

/** Is this raw field value acceptable as a tax rate? */
export function isValidRateInput(value: string): boolean {
  return RATE_PATTERN.test(value.trim())
}

/**
 * Trim and pad to the canonical four-decimal form the RPC and the database
 * store (`8.25` → `8.2500`, `100` → `100.0000`). Returns null when the input
 * is not acceptable, so callers surface `RATE_HINT` instead of guessing.
 */
export function canonicalizeRate(value: string): string | null {
  const trimmed = value.trim()
  if (!RATE_PATTERN.test(trimmed)) {
    return null
  }
  const [whole, fraction = ''] = trimmed.split('.')
  return `${whole}.${fraction.padEnd(4, '0')}`
}

/**
 * Display formatting only: trailing zeros beyond two decimals are trimmed for
 * people (`8.2500%` reads as `8.25%`), while the stored value keeps its exact
 * four-decimal form. Never used in further computation.
 */
export function formatRate(value: string | number): string {
  const rate = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(rate)) {
    return String(value)
  }
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(rate)}%`
}
