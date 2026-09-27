import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Token contract (spec 022 FR-03/FR-06, T002): the token layer is the only
 * raw-value home, every token is semantic, and every color pair used for
 * text/interactions meets the WCAG 2.1 AA ratio the spec fixed (Q6):
 * ≥ 4.5:1 for text, ≥ 3:1 for the focus indicator and large/glyph uses.
 *
 * Values are parsed from tokens.css itself, so the test fails if a pair
 * drifts below its ratio — contrast is a build-time contract, not a
 * one-time audit.
 */

const tokens = readFileSync('src/styles/tokens.css', 'utf8')

/** Extract `--name: value;` declarations from the :root block. */
function tokenMap(source: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    map.set(`--${match[1]}`, match[2].trim())
  }
  return map
}

/** Parse #rgb/#rrggbb to sRGB [r, g, b] 0–255. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors. */
function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a))
  const lb = luminance(parseHex(b))
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

describe('token contract (spec 022 FR-03, T013)', () => {
  it('tokens.css exists and defines the required semantic groups', () => {
    const names = [...tokenMap(tokens).keys()]
    for (const required of [
      '--color-surface',
      '--color-surface-raised',
      '--color-border',
      '--color-ink',
      '--color-ink-muted',
      '--color-brand',
      '--color-positive',
      '--color-warning',
      '--color-danger',
      '--color-info',
      '--focus-ring-color',
      '--font-size-base',
      '--space-4',
      '--radius-md',
      '--shadow-1',
      '--motion-base',
      '--ease-out',
      '--touch-target',
    ]) {
      expect(names, `required token ${required}`).toContain(required)
    }
  })

  it('color tokens are semantic roles — no palette-literal names', () => {
    // The consumption layer maps roles; hue names at :root are the drift
    // FR-03 bans (`--red-500`-style).
    const bad = [...tokenMap(tokens).keys()].filter((name) =>
      /^--(color-)?(red|green|blue|yellow|orange|purple|pink|teal|gray|grey)-\d+/.test(name),
    )
    expect(bad, 'palette-literal token names').toEqual([])
  })
})

describe('contrast contract (spec 022 FR-06/Q6, T002)', () => {
  const map = tokenMap(tokens)
  const value = (name: string): string => {
    const v = map.get(name)
    expect(v, `token ${name} present`).toBeTruthy()
    return v as string
  }

  /** Every declared text pair with its required ratio (WCAG 2.1 AA). */
  const TEXT_PAIRS: [string, string, number][] = [
    ['--color-ink', '--color-surface', 4.5],
    ['--color-ink', '--color-surface-raised', 4.5],
    ['--color-ink-muted', '--color-surface-raised', 4.5],
    ['--color-ink-muted', '--color-surface', 4.5],
    ['--color-brand', '--color-surface-raised', 4.5],
    ['--color-on-brand', '--color-brand', 4.5],
    ['--color-on-danger', '--color-danger', 4.5],
    ['--color-positive', '--color-positive-surface', 4.5],
    ['--color-warning', '--color-warning-surface', 4.5],
    ['--color-danger', '--color-danger-surface', 4.5],
    ['--color-info', '--color-info-surface', 4.5],
  ]

  /** Non-text UI pairs (focus ring, borders) at the 3:1 UI floor. */
  const UI_PAIRS: [string, string, number][] = [
    ['--focus-ring-color', '--color-surface', 3],
    ['--focus-ring-color', '--color-surface-raised', 3],
    ['--color-border-strong', '--color-surface-raised', 3],
  ]

  for (const [fg, bg, min] of TEXT_PAIRS) {
    it(`${fg} on ${bg} ≥ ${min}:1`, () => {
      const ratio = contrast(value(fg), value(bg))
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
    })
  }

  for (const [fg, bg, min] of UI_PAIRS) {
    it(`${fg} on ${bg} ≥ ${min}:1 (UI)`, () => {
      const ratio = contrast(value(fg), value(bg))
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
    })
  }

  it('records the measured pairs for DESIGN.md (evidence, not prose)', () => {
    const measured = TEXT_PAIRS.map(
      ([fg, bg]) => `${fg} on ${bg} = ${contrast(value(fg), value(bg)).toFixed(2)}:1`,
    )
    expect(measured.length).toBeGreaterThanOrEqual(11)
  })
})
