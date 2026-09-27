import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The styles pipeline (spec 021 FR-01 / US6): the documented import order in
 * main.tsx and the documented token-value absence in the base layer. Source
 * assertions match the repository's lightweight node-environment test method.
 */
describe('styles pipeline (spec 021 FR-01, US6)', () => {
  const main = readFileSync('src/main.tsx', 'utf8')

  it('imports reset → base → index.css in the documented order', () => {
    const reset = main.indexOf('./styles/reset.css')
    const base = main.indexOf('./styles/base.css')
    const index = main.indexOf('./index.css')
    expect(reset, 'reset.css import present').toBeGreaterThan(-1)
    expect(base, 'base.css import present').toBeGreaterThan(-1)
    expect(index, 'index.css import present').toBeGreaterThan(-1)
    expect(reset, 'reset before base').toBeLessThan(base)
    expect(base, 'base before index.css (the Phase 02 token slot sits between)').toBeLessThan(index)
  })

  it('base.css carries no token values beyond the inherited literals (documented absence)', () => {
    const base = readFileSync('src/styles/base.css', 'utf8')
    // The two ink/surface hex values moved verbatim from index.css; nothing
    // else may add color decisions. (Exhaustive: any other hex is a Phase 01
    // violation — tokens are Phase 02.)
    const hexes = base.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(new Set(hexes)).toEqual(new Set(['#1f2328', '#f6f7f9', '#ffffff']))
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
