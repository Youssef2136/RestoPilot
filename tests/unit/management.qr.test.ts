import { describe, expect, it } from 'vitest'
import {
  buildQrPngDataUrl,
  buildQrSvg,
  buildRestaurantEntryUrl,
} from '../../src/features/management/qrEntry'

/**
 * Unit suite for the restaurant QR entry point (spec 004 US5; FR-018,
 * SC-005; contracts/qr-entry-point.md §1–§2/§4).
 *
 * The payload builder is pinned exactly — it is the one load-bearing rule of
 * the artifact (`origin/r/<slug>`, nothing else) — and generation is
 * smoke-tested so a broken encoder cannot ship silently. The builder takes the
 * origin as a parameter precisely so this suite needs no DOM.
 */

describe('restaurant entry URL payload (FR-018)', () => {
  const cases: ReadonlyArray<{ origin: string; slug: string; expected: string }> = [
    {
      origin: 'http://localhost:5173',
      slug: 'blue-olive',
      expected: 'http://localhost:5173/r/blue-olive',
    },
    {
      origin: 'https://app.restopilot.example',
      slug: 'cedar-grill',
      expected: 'https://app.restopilot.example/r/cedar-grill',
    },
    {
      origin: 'https://app.restopilot.example',
      slug: 'a1',
      expected: 'https://app.restopilot.example/r/a1',
    },
    {
      origin: 'https://app.restopilot.example:8443',
      slug: 'multi-hyphen-name',
      expected: 'https://app.restopilot.example:8443/r/multi-hyphen-name',
    },
  ]

  for (const { origin, slug, expected } of cases) {
    it(`builds ${expected}`, () => {
      expect(buildRestaurantEntryUrl(origin, slug)).toBe(expected)
    })
  }

  it('carries no branch or table information — the grammar is exactly origin/r/<slug>', () => {
    const origin = 'https://app.restopilot.example'
    const payload = buildRestaurantEntryUrl(origin, 'blue-olive')

    // Exactly one path segment after /r/, and it is the slug itself.
    expect(payload.startsWith(`${origin}/r/`)).toBe(true)
    expect(payload.slice(`${origin}/r/`.length)).toBe('blue-olive')
    // No query string, fragment, or extra segment through which a branch or
    // table identifier could travel.
    expect(payload).not.toContain('?')
    expect(payload).not.toContain('#')
    expect(payload.split('/')).toHaveLength(origin.split('/').length + 2)
  })

  it('is stable while the identifier is unchanged (same inputs ⇒ identical payload)', () => {
    const first = buildRestaurantEntryUrl('https://app.restopilot.example', 'blue-olive')
    const second = buildRestaurantEntryUrl('https://app.restopilot.example', 'blue-olive')
    expect(second).toBe(first)
  })

  it('is re-derived after an identifier change: the new slug yields a different payload that names it', () => {
    const origin = 'https://app.restopilot.example'
    const before = buildRestaurantEntryUrl(origin, 'blue-olive')
    const after = buildRestaurantEntryUrl(origin, 'blue-olive-annex')

    expect(after).toBe(`${origin}/r/blue-olive-annex`)
    expect(after).not.toBe(before)
    // The old identifier is not retained or encoded anywhere (FR-004).
    expect(after).not.toContain('blue-olive/')
  })
})

describe('QR artifact generation (FR-018, SC-005)', () => {
  const payload = buildRestaurantEntryUrl('https://app.restopilot.example', 'blue-olive')

  it('produces a non-empty SVG string for the payload', async () => {
    const svg = await buildQrSvg(payload)
    expect(svg.length).toBeGreaterThan(0)
    expect(svg).toContain('<svg')
  })

  it('produces a PNG data URL for the same payload', async () => {
    const dataUrl = await buildQrPngDataUrl(payload)
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUrl.length).toBeGreaterThan('data:image/png;base64,'.length)
  })

  it('encodes the same payload in both formats — identical inputs give identical artifacts', async () => {
    const firstSvg = await buildQrSvg(payload)
    const secondSvg = await buildQrSvg(payload)
    const firstPng = await buildQrPngDataUrl(payload)
    const secondPng = await buildQrPngDataUrl(payload)

    expect(secondSvg).toBe(firstSvg)
    expect(secondPng).toBe(firstPng)
  })

  it('a different payload yields a different artifact (the encoding tracks the URL)', async () => {
    const other = buildRestaurantEntryUrl('https://app.restopilot.example', 'blue-olive-annex')
    expect(await buildQrSvg(other)).not.toBe(await buildQrSvg(payload))
  })
})
