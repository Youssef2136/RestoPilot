import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RootPage } from '../../src/routes/RootPage'
import { orderRedirectTarget } from '../../src/routes/OrderPage'
import { SessionJoinNotice } from '../../src/features/session/components/entry/SessionJoinNotice'

/**
 * Route-decision unit pins (spec 024 FR-08/FR-09/FR-02/FR-06; plan T001).
 *
 * The root landing and the order deep-link redirect are this phase's two
 * CONTRACT decisions (Q1/Q2): the landing's h1 is the routes/smoke/a11y pin,
 * the redirect is the deliberate C1 migration. Rendering through a
 * MemoryRouter keeps the pins independent of the dev server.
 */

describe('the root landing (C2, FR-08)', () => {
  it('keeps the RestoPilot h1 and offers the two real ways in', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RootPage />
      </MemoryRouter>,
    )
    expect(html).toContain('<h1')
    expect(html).toContain('RestoPilot')
    // The staff way in — a link, not a form (no credential surface here).
    expect(html).toContain('/signin')
    // The customer way in: the QR/slug guidance (no directory exists — Q1).
    expect(html).toContain('/r/')
  })

  it('acknowledges an echoed order deep-link branch', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/?branch=demo-branch']}>
        <RootPage />
      </MemoryRouter>,
    )
    expect(html).toContain('QR code')
    expect(html).toContain('role="status"')
  })
})

describe('the order deep-link redirect (C1, FR-09)', () => {
  it('maps /order/:branchId to the landing with the branch echo', () => {
    // The pure mapping (the <Navigate> wrapper needs a DOM; the project's
    // unit environment renders statically — the mapping is the contract).
    expect(orderRedirectTarget('demo-branch')).toBe('/?branch=demo-branch')
    expect(orderRedirectTarget('a b/c')).toBe('/?branch=a%20b%2Fc')
    expect(orderRedirectTarget(undefined)).toBe('/')
    expect(orderRedirectTarget('')).toBe('/')
  })
})

describe('the join-session guidance (Q4, FR-06)', () => {
  it('carries the standing note under the table picker', () => {
    const html = renderToStaticMarkup(<SessionJoinNotice />)
    expect(html).toContain('join')
    expect(html).toContain('participant')
  })
})
