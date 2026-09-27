import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The FR-07 drift rule (spec 022): tokens.css is the ONLY raw color home.
 * Component stylesheets (CSS Modules) and the global layers consume vars.
 *
 * The dev gallery page is exempt (dev-only review surface, never shipped),
 * and pre-system incumbent files are an explicit, justified allowlist — each
 * entry names the phase that absorbs it. Entries require a written
 * justification here; "it was easier" is not one. The scan is over CSS
 * files' raw values (hex literals); functional pseudo-value syntax like
 * `rgb(0 0 0 / alpha)` shadows derived from ink are likewise banned outside
 * tokens.css (elevation lives there).
 */

/** Justified raw-value exemptions. Empty is the goal; entries expire when
 *  their absorbing phase lands. */
const ALLOWLIST: { file: string; justification: string }[] = [
  {
    file: 'src/components/AppShell.module.css',
    justification:
      'Incumbent placeholder shell (Master Plan §2.1): Phase 03 replaces the shell entirely; tokens consumed there, not patched here.',
  },
  {
    file: 'src/index.css',
    justification:
      'Incumbent page-typographic defaults (muted-ink paragraph color): Phase 03 surface restyling absorbs it into tokens; not a component file.',
  },
]

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RGB = /\brgba?\(/g

describe('raw-value drift rule (spec 022 FR-07, T013)', () => {
  it('tokens.css is the single raw-value home and exists with values', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8')
    expect(tokens).toMatch(/--color-ink:\s*#/)
  })

  it('every other component/global stylesheet consumes tokens (no raw colors)', () => {
    const violations: string[] = []
    for (const path of CSS_FILES) {
      const raw = readFileSync(path, 'utf8')
      const hex = raw.match(HEX) ?? []
      const rgb = raw.match(RGB) ?? []
      if (hex.length === 0 && rgb.length === 0) continue
      const allowed = ALLOWLIST.find((a) => a.file === path)
      if (allowed) continue
      violations.push(`${path}: ${[...hex, ...rgb].join(', ')}`)
    }
    expect(
      violations,
      `raw values outside tokens.css (justify in ALLOWLIST or consume vars):\n  ${violations.join('\n  ')}`,
    ).toEqual([])
  })

  it('allowlist entries stay minimal and justified', () => {
    expect(ALLOWLIST.length, 'exemptions must not grow casually').toBeLessThanOrEqual(2)
    for (const entry of ALLOWLIST) {
      expect(entry.justification.length, `${entry.file} justification`).toBeGreaterThan(40)
    }
  })
})

/** Discovered once at module load: all CSS under src except tokens.css and
 *  the dev-only gallery page (which lives beside src/routes but styles via
 *  inline dev markup and is excluded from production builds). */
const CSS_FILES: string[] = (() => {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (/\.css$/.test(full) && !full.includes('tokens.css')) {
        out.push(full.replace(/\\/g, '/'))
      }
    }
  }
  walk('src')
  return out.sort()
})()
