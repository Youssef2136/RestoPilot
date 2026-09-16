import QRCode from 'qrcode'

/**
 * Restaurant QR entry point (contracts/qr-entry-point.md §1–§2; FR-018,
 * FR-019): the one artifact the V1 customer entry point needs — a
 * restaurant-level QR whose payload is the restaurant's public entry URL.
 *
 * The payload builder is exported separately and is the single source of the
 * rule: `` `${origin}/r/${slug}` ``. `/r/:restaurantSlug` is feature 001's
 * public restaurant route; there is no code path that appends a branch or
 * table identifier, and nothing here caches or stores the payload — callers
 * re-derive it from the restaurant's CURRENT slug on every render (FR-004:
 * after a confirmed identifier change the next artifact encodes the new URL,
 * and the old identifier is retained nowhere).
 *
 * `origin` is the application's own origin at render time
 * (`window.location.origin` in the UI). No configuration value participates
 * and no environment variable exists.
 */

/** The public entry URL for a restaurant, exactly `origin/r/<slug>`. */
export function buildRestaurantEntryUrl(origin: string, slug: string): string {
  return `${origin}/r/${slug}`
}

/**
 * The print-quality vector artifact (in-page display and the SVG download).
 * Same payload, same options as the PNG below — one artifact per format, no
 * per-table or per-branch variant.
 */
export function buildQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
}

/** The raster artifact (PNG download), 1024px wide, encoding the same payload. */
export function buildQrPngDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })
}
