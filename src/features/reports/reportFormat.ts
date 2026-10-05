import type { ReportPeriod } from './reportsClient'

/**
 * Report presentation helpers (spec 033; Master Plan §Frontend Phase 13).
 * Presentation ONLY: no money arithmetic exists here (Constitution II —
 * every figure renders from the RPC through formatPrice); these helpers
 * shape what the RPCs already returned.
 */

/** The audit page size the client requests (useAudit) — the server clamps 1..200. */
export const CLAMP_PAGE_SIZE = 200

/**
 * The clamp notice shows only when a page comes back full: the server may
 * hold more rows beyond an exact-limit page (the state matrix's clamp row).
 */
export function isClampReached(count: number, limit: number = CLAMP_PAGE_SIZE): boolean {
  return Number.isFinite(count) && count >= limit
}

/**
 * A bar's width as a share of the visible max (0..1). Zero-safe: an empty
 * or all-zero list renders no bar at all (max <= 0 → 0), and a value above
 * the max clamps to the full width.
 */
export function barShare(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  if (value <= 0) return 0
  return Math.min(value / max, 1)
}

/**
 * The comparison's same-period sentence (D1): the EXACT range the server
 * returned for the anchored branch, restated once so every row reads under
 * the same guarantee.
 */
export function comparisonPeriodSentence(period: ReportPeriod, from: string, to: string): string {
  const label = period === 'day' ? 'day' : period === 'week' ? 'week' : 'month'
  return `Same ${label} for every branch: ${from.slice(0, 10)} → ${to.slice(0, 10)}`
}
