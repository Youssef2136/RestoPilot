/*
 * The /admin landing posture unit suite (spec 034 D5, FR-01; T005). The
 * posture paragraph must: ride the SAME overview query the console uses
 * (one mocked source — no second shape, FR-10), report the tenants and
 * disabled counts from it, and carry the honesty statement about what the
 * capability grants. It must stay absent for non-super-admin identities
 * and while the query is still pending. Node-environment render (the house
 * method): react-dom/server, no DOM.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const harness = vi.hoisted(() => ({
  profile: null as { display_name: string; is_super_admin: boolean } | null,
  isPending: false,
  isError: false,
  overview: undefined as { name: string; platform_disabled: boolean }[] | undefined,
}))

vi.mock('../../src/features/auth/useAuthContext', () => ({
  useAuthContext: () => harness,
}))

vi.mock('../../src/features/platform/usePlatform', () => ({
  usePlatformOverview: () => ({
    data: harness.overview,
    isPending: harness.overview === undefined,
  }),
}))

const { AdminPage } = await import('../../src/routes/AdminPage')

describe('the /admin landing posture (spec 034 D5, FR-01)', () => {
  it('reports the tenants and disabled counts from the shared overview query', () => {
    harness.profile = { display_name: 'Platform Admin', is_super_admin: true }
    harness.overview = [
      { name: 'Blue Olive', platform_disabled: false },
      { name: 'Cedar Grill', platform_disabled: true },
    ]
    const html = renderToStaticMarkup(<AdminPage />)
    expect(html).toContain('Platform posture: 2 tenants')
    expect(html).toContain('1 disabled')
    expect(html).toContain('it grants no restaurant data beyond the overview')
  })

  it('stays silent for a non-super-admin even when overview data exists', () => {
    harness.profile = { display_name: 'Alice', is_super_admin: false }
    harness.overview = [{ name: 'Blue Olive', platform_disabled: false }]
    const html = renderToStaticMarkup(<AdminPage />)
    expect(html).not.toContain('Platform posture')
  })

  it('renders no posture while the overview query is pending', () => {
    harness.profile = { display_name: 'Platform Admin', is_super_admin: true }
    harness.overview = undefined
    const html = renderToStaticMarkup(<AdminPage />)
    expect(html).not.toContain('Platform posture')
    expect(html).toContain('holds the platform super-admin capability')
  })
})
