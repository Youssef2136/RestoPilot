import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button, IconButton } from '../../../src/components/ui'

/**
 * Button/IconButton contract (spec 022 FR-09/T012): static-markup assertions
 * (node environment — repo method). Keyboard/focus behavior is E2E-proven.
 */

describe('Button contract (spec 022 T012)', () => {
  it('renders a native button defaulting to type="button"', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>)
    expect(html).toContain('<button type="button"')
    expect(html).toContain('>Save<')
  })

  it('keeps the accessible label while loading and sets aria-busy', () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('>Save<')
    expect(html).toContain('spinner') // the visual indicator rides along
  })

  it('marks danger variant for the destructive styling hook', () => {
    const html = renderToStaticMarkup(<Button variant="danger">Delete</Button>)
    expect(html).toMatch(/class="[^"]*danger/)
  })

  it('honors an explicit type="submit" for form-owning callers', () => {
    const html = renderToStaticMarkup(<Button type="submit">Search</Button>)
    expect(html).toContain('<button type="submit"')
  })
})

describe('IconButton contract (spec 022 T012)', () => {
  it('never ships unlabeled: aria-label + title from the label prop', () => {
    const html = renderToStaticMarkup(<IconButton icon="settings" label="Settings" />)
    expect(html).toContain('aria-label="Settings"')
    expect(html).toContain('title="Settings"')
    expect(html).toContain('<svg') // the icon renders
    expect(html).toContain('aria-hidden="true"') // decorative to AT
  })
})
