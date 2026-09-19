/**
 * Exact money handling for the menu module (contracts/menu-client.md §1;
 * research.md §9).
 *
 * Amounts are exact decimal strings end to end: validated here, canonicalised
 * to two decimals, sent to the RPC as strings, and rendered for display only.
 * NO arithmetic is performed on money in application code — the features that
 * must total amounts (tax, rounds, bills) compute in SQL, where `numeric` is
 * exact. The single currency and its two-decimal minor unit are the V1
 * deployment assumption (spec Assumptions).
 */

/** The accepted input shape: up to nine integer digits, at most two decimals. */
export const PRICE_PATTERN = /^\d{1,9}(\.\d{1,2})?$/

/** The upper bound the RPC enforces (`numeric(12,2)` with a nine-digit cap). */
export const PRICE_MAXIMUM = '999999999.99'

/** Shown next to a rejected price field. */
export const PRICE_HINT = 'Enter an amount like 12.50 — digits and up to two decimal places.'

/** Is this raw field value acceptable as a price or adjustment? */
export function isValidPriceInput(value: string): boolean {
  return PRICE_PATTERN.test(value.trim())
}

/**
 * Trim and pad to the canonical two-decimal form the RPC and the database
 * store (`12.5` → `12.50`). Returns null when the input is not acceptable, so
 * callers can surface `PRICE_HINT` instead of guessing.
 */
export function canonicalizePrice(value: string): string | null {
  const trimmed = value.trim()
  if (!PRICE_PATTERN.test(trimmed)) {
    return null
  }
  const [whole, fraction = ''] = trimmed.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

/**
 * Display formatting only. Table reads arrive through PostgREST, where a
 * `numeric` column is a JSON number; the branch projection sends the same
 * value as exact text. Both are accepted here, both are parsed to a number
 * for `Intl.NumberFormat`, and neither is ever used in further computation —
 * so no rounding drift can reach the data layer.
 */
export function formatPrice(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) {
    return String(value)
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** An extra's adjustment for display: zero reads as a free extra. */
export function formatAdjustment(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) {
    return String(value)
  }
  return amount === 0 ? 'Free' : `+${formatPrice(value)}`
}
