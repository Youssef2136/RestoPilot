import { useEffect, useState } from 'react'
import { buildQrPngDataUrl, buildQrSvg, buildRestaurantEntryUrl } from '../qrEntry'

/**
 * The owner's QR entry point panel (contracts/qr-entry-point.md §2–§3;
 * FR-018): the restaurant-level code, its payload as visible text (so the
 * target is verifiable without decoding), and the SVG + PNG downloads.
 *
 * Everything is re-derived from the CURRENT slug on every render of this
 * component — nothing is cached, stored, or served from the platform, so a
 * confirmed identifier change (FR-004) is reflected by the next rendering with
 * no invalidation step. Mounted inside the management page's owner gate; the
 * slug itself is owner-readable under the existing policies, and non-owners of
 * the restaurant cannot read the row at all.
 */

/** `window.location.origin` at render time — the deployment's own origin (V1). */
function currentOrigin(): string {
  return window.location.origin
}

/** Hands a generated artifact to the browser as a file download. */
function downloadArtifact(filename: string, href: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
}

export function RestaurantQrPanel({ slug }: { slug: string }) {
  const payload = buildRestaurantEntryUrl(currentOrigin(), slug)
  const [svg, setSvg] = useState<string | null>(null)
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null)

  // Regenerate whenever the payload changes (a slug change, or a remount after
  // one) — the effect keyed on the payload is what keeps the artifact current
  // without any cache to invalidate.
  useEffect(() => {
    let active = true
    setSvg(null)
    setPngDataUrl(null)
    void Promise.all([buildQrSvg(payload), buildQrPngDataUrl(payload)]).then(
      ([nextSvg, nextPng]) => {
        if (active) {
          setSvg(nextSvg)
          setPngDataUrl(nextPng)
        }
      },
    )
    return () => {
      active = false
    }
  }, [payload])

  return (
    <section aria-labelledby="restaurant-qr-heading">
      <h2 id="restaurant-qr-heading">Customer entry QR</h2>
      <p>
        One restaurant-level code for the printed entry point. It encodes the public entry URL and
        carries no branch or table information — customers pick their table in the ordering flow.
      </p>

      {/* The payload is shown next to the code so the target can be checked
          without scanning it. */}
      <p>
        Entry URL: <span data-testid="qr-entry-url">{payload}</span>
      </p>

      {svg === null ? (
        <p>Generating the code…</p>
      ) : (
        // The QR source is generated locally from the restaurant's own
        // identifier (`[a-z0-9-]` only, database-enforced), never from user
        // input.
        <div data-testid="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      )}

      <p>
        <button
          type="button"
          disabled={svg === null}
          onClick={() => {
            if (svg !== null) {
              downloadArtifact(
                `${slug}-entry-qr.svg`,
                `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
              )
            }
          }}
        >
          Download SVG
        </button>{' '}
        <button
          type="button"
          disabled={pngDataUrl === null}
          onClick={() => {
            if (pngDataUrl !== null) {
              downloadArtifact(`${slug}-entry-qr.png`, pngDataUrl)
            }
          }}
        >
          Download PNG
        </button>
      </p>
    </section>
  )
}
