import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The styles pipeline (spec 021 FR-01 / US6): the documented import order in
 * main.tsx and the documented token-value absence in the base layer. Source
 * assertions match the repository's lightweight node-environment test method.
 */
describe('styles pipeline (spec 021 FR-01, US6)', () => {
  const main = readFileSync('src/main.tsx', 'utf8')

  it('imports reset → tokens → base → index.css in the documented order', () => {
    const reset = main.indexOf('./styles/reset.css')
    const tokens = main.indexOf('./styles/tokens.css')
    const base = main.indexOf('./styles/base.css')
    const index = main.indexOf('./index.css')
    expect(reset, 'reset.css import present').toBeGreaterThan(-1)
    expect(tokens, 'tokens.css import present (spec 022 FR-03)').toBeGreaterThan(-1)
    expect(base, 'base.css import present').toBeGreaterThan(-1)
    expect(index, 'index.css import present').toBeGreaterThan(-1)
    expect(reset, 'reset before tokens').toBeLessThan(tokens)
    expect(tokens, 'tokens before base').toBeLessThan(base)
    expect(base, 'base before index.css').toBeLessThan(index)
  })

  it('base.css carries no raw values — all decisions live in tokens.css (spec 022 FR-03/FR-07)', () => {
    const base = readFileSync('src/styles/base.css', 'utf8')
    // Phase 02 tokenized the inherited literals: base.css consumes vars only.
    // (Exhaustive: any hex here is a drift violation — tokens.css is the
    // single raw-value home, FR-07.)
    const hexes = base.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexes, 'no raw colors in base.css').toEqual([])
    expect(base).toContain('var(--color-ink)')
    expect(base).toContain('var(--color-surface)')
  })

  it('base.css implements the focus policy and skip link, not component styling', () => {
    const base = readFileSync('src/styles/base.css', 'utf8')
    expect(base).toContain(':focus-visible')
    expect(base).toContain('.skip-link')
    expect(base).toContain('#main')
    expect(base).not.toMatch(/\.(btn|button|card|input|dialog|toast)\b/)
  })

  it('reset.css stays purely structural (no colors, no typography)', () => {
    const reset = readFileSync('src/styles/reset.css', 'utf8')
    expect(reset).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(reset).not.toMatch(/font-family|color:/)
  })
})
