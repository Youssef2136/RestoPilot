import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { ReactElement } from 'react'

import type { AuthSessionState } from '../../src/features/auth/AuthProvider'
import { RequireStaff, RequireSuperAdmin } from '../../src/features/auth/guards'
import {
  AUTH_CONTEXT_QUERY_KEY,
  useAuthContext,
  type AuthContext,
  type AuthContextMembership,
} from '../../src/features/auth/useAuthContext'
import { StaffListPage } from '../../src/routes/StaffListPage'
import {
  authUserIds,
  branchIds,
  profileIds,
  restaurantIds,
  seedBranches,
  seedMemberships,
  seedProfiles,
  seedRestaurants,
  type SeedMembership,
} from '../database/helpers/fixtures'

/**
 * The guard/route-permission decision matrix (spec FR-013/FR-014/FR-015;
 * plan.md Testing; research.md §10) — every route × every seeded persona.
 *
 * Rendering strategy: static server-side rendering in the node environment
 * (no DOM test environment is installed — research.md adds no test
 * dependencies). Two seams make guard decisions observable without effects:
 *
 * 1. `AuthProvider` is mocked: `useAuthSession` returns the scenario's
 *    session state directly (the provider's real event subscription is an
 *    effect and never runs under static rendering).
 * 2. The context query cache is pre-seeded per scenario, so the real
 *    `useAuthContext` hook resolves synchronously — the guards are tested
 *    against the hook's genuine predicates, never against stubs.
 * 3. `react-router`'s `Navigate` is replaced by a probe that records the
 *    redirect target/payload (`Navigate` performs navigation in an effect).
 *    The real redirect behavior — URL changes and the return-to round-trip —
 *    is proven in a real browser by e2e/auth.routes.test.ts.
 */

const harness = vi.hoisted(() => ({
  session: {
    session: null,
    status: 'loading',
  } as { session: { user: { id: string } } | null; status: AuthSessionState['status'] },
  context: {
    profile: null,
    memberships: [],
  } as {
    profile: { id: string; display_name: string; is_super_admin: boolean } | null
    memberships: Array<{
      restaurant_id: string
      restaurant_slug: string
      restaurant_name: string
      role: 'owner' | 'branch_manager' | 'cashier' | 'kitchen'
      branch_id: string | null
      branch_name: string | null
    }>
  },
  redirects: [] as Array<{ to: string; replace?: boolean; state?: unknown }>,
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuthSession: () => harness.session as unknown as AuthSessionState,
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  const NavigateProbe = (props: { to: string; replace?: boolean; state?: unknown }) => {
    harness.redirects.push({ to: props.to, replace: props.replace, state: props.state })
    return <p>redirect</p>
  }
  return { ...actual, Navigate: NavigateProbe as unknown as typeof actual.Navigate }
})

/** Every staff-area route (route guard: RequireStaff). */
const STAFF_ROUTES = ['/dashboard', '/dashboard/profile', '/dashboard/staff'] as const

const PROTECTED_MARKER = 'guarded-route-content'

function Guarded() {
  return <p>{PROTECTED_MARKER}</p>
}

function StaffListPredicateProbe() {
  const { canReadStaffList } = useAuthContext()
  return (
    <ul>
      <li>blue-olive:{String(canReadStaffList(restaurantIds.blueOlive))}</li>
      <li>cedar-grill:{String(canReadStaffList(restaurantIds.cedarGrill))}</li>
    </ul>
  )
}

type Persona = keyof typeof profileIds

/** Builds the RPC-shaped effective context of a seeded persona. */
function contextFor(persona: Persona): AuthContext {
  const profile = seedProfiles.find((p) => p.id === profileIds[persona])
  if (profile === undefined) {
    throw new Error(`unknown seeded profile: ${persona}`)
  }
  return {
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      is_super_admin: profile.is_super_admin,
    },
    memberships: seedMemberships
      .filter((membership) => membership.profile_id === profile.id)
      .map(toContextMembership),
  }
}

function toContextMembership(membership: SeedMembership): AuthContextMembership {
  const restaurant = seedRestaurants.find((r) => r.id === membership.restaurant_id)
  if (restaurant === undefined) {
    throw new Error(`unknown seeded restaurant: ${membership.restaurant_id}`)
  }
  const branch = seedBranches.find((b) => b.id === membership.branch_id)
  return {
    restaurant_id: membership.restaurant_id,
    restaurant_slug: restaurant.slug,
    restaurant_name: restaurant.name,
    role: membership.role,
    branch_id: membership.branch_id,
    branch_name: branch?.name ?? null,
  }
}

function signInAs(persona: Persona): void {
  harness.session = { session: { user: { id: authUserIds[persona] } }, status: 'signed-in' }
  harness.context = contextFor(persona)
}

/** FR-005: authenticated, but no linked profile (and therefore no memberships). */
function signInAsUnlinked(): void {
  harness.session = {
    session: { user: { id: '00000000-0000-4000-8000-000000009999' } },
    status: 'signed-in',
  }
  harness.context = { profile: null, memberships: [] }
}

/**
 * Renders one guard element at `url` with the scenario's session state and
 * effective context pre-seeded into a fresh query cache.
 */
function renderGuarded(element: ReactElement, url: string): string {
  harness.redirects.length = 0
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const userId = harness.session.session?.user.id
  if (userId !== undefined) {
    queryClient.setQueryData([...AUTH_CONTEXT_QUERY_KEY, userId], harness.context)
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  harness.session = { session: null, status: 'loading' }
  harness.context = { profile: null, memberships: [] }
  harness.redirects.length = 0
})

describe('unauthenticated visitors are redirected with return-to (FR-013)', () => {
  for (const path of STAFF_ROUTES) {
    it(`redirects ${path} to /signin carrying the requested location`, () => {
      harness.session = { session: null, status: 'signed-out' }
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(harness.redirects).toEqual([{ to: '/signin', replace: true, state: { from: path } }])
      expect(html).not.toContain(PROTECTED_MARKER)
      expect(html).not.toContain('Not authorized')
    })
  }

  it('redirects /admin to /signin carrying the requested location', () => {
    harness.session = { session: null, status: 'signed-out' }
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(harness.redirects).toEqual([{ to: '/signin', replace: true, state: { from: '/admin' } }])
    expect(html).not.toContain(PROTECTED_MARKER)
  })

  it('preserves the query string in the return-to destination', () => {
    harness.session = { session: null, status: 'signed-out' }
    renderGuarded(
      <RequireStaff>
        <Guarded />
      </RequireStaff>,
      '/dashboard?restaurant=blue-olive',
    )
    expect(harness.redirects).toEqual([
      { to: '/signin', replace: true, state: { from: '/dashboard?restaurant=blue-olive' } },
    ])
  })

  it('renders nothing while the session restore is in flight (no flash, no premature redirect)', () => {
    const html = renderGuarded(
      <RequireStaff>
        <Guarded />
      </RequireStaff>,
      '/dashboard',
    )
    expect(html).toBe('')
    expect(harness.redirects).toEqual([])
  })
})

describe('a signed-in unlinked identity is rejected on every guarded route (FR-005, FR-014)', () => {
  for (const path of STAFF_ROUTES) {
    it(`renders NotAuthorized at ${path}`, () => {
      signInAsUnlinked()
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(html).toContain('Not authorized')
      expect(harness.redirects).toEqual([])
    })
  }

  it('renders NotAuthorized at /admin', () => {
    signInAsUnlinked()
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
    expect(harness.redirects).toEqual([])
  })
})

describe('owner (alice): all staff views including the staff list', () => {
  beforeEach(() => signInAs('alice'))

  for (const path of STAFF_ROUTES) {
    it(`reaches ${path}`, () => {
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(html).toContain(PROTECTED_MARKER)
      expect(html).not.toContain('Not authorized')
      expect(harness.redirects).toEqual([])
    })
  }

  it('holds restaurant-wide scope (both branches of Blue Olive)', () => {
    expect(harness.context.memberships).toEqual([
      expect.objectContaining({ role: 'owner', branch_id: null, branch_name: null }),
    ])
  })

  it('cannot reach /admin (FR-012 — the capability is the only key)', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
  })
})

describe('branch manager (bob): own-branch scope plus the staff list', () => {
  beforeEach(() => signInAs('bob'))

  for (const path of STAFF_ROUTES) {
    it(`reaches ${path}`, () => {
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(html).toContain(PROTECTED_MARKER)
      expect(html).not.toContain('Not authorized')
    })
  }

  it('holds own-branch scope (Downtown only)', () => {
    expect(harness.context.memberships).toEqual([
      expect.objectContaining({
        role: 'branch_manager',
        branch_id: branchIds.downtown,
        branch_name: 'Downtown',
      }),
    ])
  })

  it('passes the staff-list gate for their restaurant', () => {
    const html = renderGuarded(<StaffListPage />, '/dashboard/staff')
    expect(html).toContain('Staff list')
    expect(html).not.toContain('Not authorized')
  })

  it('cannot reach /admin', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
  })
})

describe('cashier (carla): own-branch scope, staff list denied (FR-007, FR-014)', () => {
  beforeEach(() => signInAs('carla'))

  it.each(['/dashboard', '/dashboard/profile'])('reaches %s', (path) => {
    const html = renderGuarded(
      <RequireStaff>
        <Guarded />
      </RequireStaff>,
      path,
    )
    expect(html).toContain(PROTECTED_MARKER)
    expect(html).not.toContain('Not authorized')
  })

  it('holds own-branch scope (Downtown only)', () => {
    expect(harness.context.memberships).toEqual([
      expect.objectContaining({ role: 'cashier', branch_id: branchIds.downtown }),
    ])
  })

  it('deep link to /dashboard/staff is rejected by the staff-list gate, not hidden', () => {
    const html = renderGuarded(<StaffListPage />, '/dashboard/staff')
    expect(html).toContain('Not authorized')
    expect(harness.redirects).toEqual([])
  })

  it('cannot reach /admin', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
  })
})

describe('kitchen (dan): own-branch scope, staff list denied (FR-007, FR-014)', () => {
  beforeEach(() => signInAs('dan'))

  it.each(['/dashboard', '/dashboard/profile'])('reaches %s', (path) => {
    const html = renderGuarded(
      <RequireStaff>
        <Guarded />
      </RequireStaff>,
      path,
    )
    expect(html).toContain(PROTECTED_MARKER)
    expect(html).not.toContain('Not authorized')
  })

  it('holds own-branch scope (Marina only)', () => {
    expect(harness.context.memberships).toEqual([
      expect.objectContaining({ role: 'kitchen', branch_id: branchIds.marina }),
    ])
  })

  it('deep link to /dashboard/staff is rejected by the staff-list gate, not hidden', () => {
    const html = renderGuarded(<StaffListPage />, '/dashboard/staff')
    expect(html).toContain('Not authorized')
    expect(harness.redirects).toEqual([])
  })

  it('cannot reach /admin', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
  })
})

describe('multi-membership member (eve): the union of scopes (FR-015)', () => {
  beforeEach(() => signInAs('eve'))

  for (const path of STAFF_ROUTES) {
    it(`reaches ${path}`, () => {
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(html).toContain(PROTECTED_MARKER)
      expect(html).not.toContain('Not authorized')
    })
  }

  it('holds the union of both restaurants’ scopes', () => {
    const scoped = harness.context.memberships.map((m) => `${m.restaurant_name}:${m.role}`)
    expect(scoped).toEqual(['Cedar Grill:owner', 'Blue Olive:cashier'])
  })

  it('passes the staff-list gate (readable via the Cedar Grill ownership)', () => {
    const html = renderGuarded(<StaffListPage />, '/dashboard/staff')
    expect(html).toContain('Staff list')
    expect(html).not.toContain('Not authorized')
  })

  it('cannot reach /admin', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain('Not authorized')
  })
})

describe('platform super admin (FR-012): /admin only', () => {
  beforeEach(() => signInAs('platformAdmin'))

  for (const path of STAFF_ROUTES) {
    it(`is rejected at ${path} — the capability grants no staff scope`, () => {
      const html = renderGuarded(
        <RequireStaff>
          <Guarded />
        </RequireStaff>,
        path,
      )
      expect(html).toContain('Not authorized')
      expect(harness.redirects).toEqual([])
    })
  }

  it('reaches /admin', () => {
    const html = renderGuarded(
      <RequireSuperAdmin>
        <Guarded />
      </RequireSuperAdmin>,
      '/admin',
    )
    expect(html).toContain(PROTECTED_MARKER)
    expect(html).not.toContain('Not authorized')
  })
})

describe('canReadStaffList predicate truth table (FR-007)', () => {
  const cases: Array<{
    persona: string
    signIn: () => void
    blueOlive: boolean
    cedarGrill: boolean
  }> = [
    {
      persona: 'owner (alice)',
      signIn: () => signInAs('alice'),
      blueOlive: true,
      cedarGrill: false,
    },
    {
      persona: 'branch manager (bob)',
      signIn: () => signInAs('bob'),
      blueOlive: true,
      cedarGrill: false,
    },
    {
      persona: 'cashier (carla)',
      signIn: () => signInAs('carla'),
      blueOlive: false,
      cedarGrill: false,
    },
    {
      persona: 'kitchen (dan)',
      signIn: () => signInAs('dan'),
      blueOlive: false,
      cedarGrill: false,
    },
    {
      persona: 'multi-membership (eve)',
      signIn: () => signInAs('eve'),
      blueOlive: false,
      cedarGrill: true,
    },
    {
      persona: 'super admin (platform admin)',
      signIn: () => signInAs('platformAdmin'),
      blueOlive: false,
      cedarGrill: false,
    },
    {
      persona: 'unlinked identity',
      signIn: () => signInAsUnlinked(),
      blueOlive: false,
      cedarGrill: false,
    },
  ]

  for (const testCase of cases) {
    it(`${testCase.persona}: blue-olive=${testCase.blueOlive}, cedar-grill=${testCase.cedarGrill}`, () => {
      testCase.signIn()
      const html = renderGuarded(<StaffListPredicateProbe />, '/dashboard')
      expect(html).toContain(`blue-olive:${testCase.blueOlive}`)
      expect(html).toContain(`cedar-grill:${testCase.cedarGrill}`)
    })
  }
})
