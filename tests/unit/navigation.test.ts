import { describe, expect, it } from 'vitest'
import { PLATFORM_NAV_ITEMS, STAFF_NAV_ITEMS, visibleNavItems } from '../../src/app/navigation'
import type { AuthContextMembership } from '../../src/features/auth/useAuthContext'

/**
 * The persona × nav-item matrix (spec 023 FR-02/T001; research R1): the
 * exhaustive pin of who sees what — the sidebar, the drawer, and the
 * dashboard shortcuts all render THIS model, so this test is the single
 * authorization-presentation contract. Visibility is advisory; the RPCs
 * remain the boundary (Constitution IV).
 */

const blueOlive = '00000000-0000-4000-8000-000000000001'
const cedarGrill = '00000000-0000-4000-8000-000000000002'

function membership(
  restaurantId: string,
  role: AuthContextMembership['role'],
  branchId: string | null = null,
): AuthContextMembership {
  return {
    restaurant_id: restaurantId,
    restaurant_slug: 'slug',
    restaurant_name: 'Restaurant',
    role,
    branch_id: branchId,
    branch_name: branchId === null ? null : 'Branch',
  }
}

function labels(memberships: AuthContextMembership[], restaurantId: string | null): string[] {
  return visibleNavItems(STAFF_NAV_ITEMS, memberships, restaurantId).map((i) => i.label)
}

describe('nav model matrix (spec 023 FR-02/T001)', () => {
  it('an owner sees every entry of their restaurant', () => {
    const items = labels([membership(blueOlive, 'owner')], blueOlive)
    expect(items).toEqual([
      'Dashboard',
      'Sessions',
      'Rounds',
      'Kitchen',
      'Branches',
      'Staff list',
      'Restaurant',
      'Menu',
      'Tax',
      'Reports',
      'Void log',
      'Audit trail',
      'Profile',
    ])
  })

  it('a branch manager sees operations + their branch surfaces, not owner-only config', () => {
    const items = labels([membership(blueOlive, 'branch_manager', 'branch-1')], blueOlive)
    expect(items).toEqual([
      'Dashboard',
      'Sessions',
      'Rounds',
      'Kitchen',
      'Branches',
      'Staff list',
      'Reports',
      'Void log',
      'Audit trail',
      'Profile',
    ])
    expect(items).not.toContain('Restaurant')
    expect(items).not.toContain('Menu')
    expect(items).not.toContain('Tax')
  })

  it('a cashier sees sessions/rounds/kitchen but never money surfaces', () => {
    const items = labels([membership(blueOlive, 'cashier', 'branch-1')], blueOlive)
    expect(items).toContain('Sessions')
    expect(items).toContain('Rounds')
    expect(items).toContain('Kitchen')
    expect(items).not.toContain('Reports')
    expect(items).not.toContain('Void log')
    expect(items).not.toContain('Audit trail')
    expect(items).not.toContain('Staff list')
    expect(items).not.toContain('Menu')
    expect(items).not.toContain('Tax')
    expect(items).not.toContain('Restaurant')
  })

  it('a kitchen member never sees the cashier/money entries', () => {
    const items = labels([membership(blueOlive, 'kitchen', 'branch-1')], blueOlive)
    expect(items).toEqual(['Dashboard', 'Kitchen', 'Branches', 'Profile'])
    expect(items).not.toContain('Sessions')
    expect(items).not.toContain('Rounds')
    expect(items).not.toContain('Reports')
    expect(items).not.toContain('Tax')
  })

  it('a member of another restaurant sees nothing restaurant-specific for a foreign context', () => {
    const items = labels([membership(cedarGrill, 'owner')], blueOlive)
    expect(items).toEqual(['Dashboard', 'Profile'])
  })

  it('a null restaurant context (unresolved) shows only the always-visible entries', () => {
    const items = labels([membership(blueOlive, 'owner')], null)
    expect(items).toEqual(['Dashboard', 'Profile'])
  })

  it('multi-membership: either restaurant context resolves its own set', () => {
    const memberships = [
      membership(blueOlive, 'cashier', 'branch-1'),
      membership(cedarGrill, 'owner'),
    ]
    expect(labels(memberships, blueOlive)).not.toContain('Restaurant')
    expect(labels(memberships, cedarGrill)).toContain('Restaurant')
  })

  it('the canonical order is fixed regardless of membership order (Q1)', () => {
    const items = labels(
      [membership(cedarGrill, 'owner'), membership(blueOlive, 'owner')],
      blueOlive,
    )
    expect(items.indexOf('Sessions')).toBeLessThan(items.indexOf('Branches'))
    expect(items.indexOf('Branches')).toBeLessThan(items.indexOf('Reports'))
    expect(items.indexOf('Reports')).toBeLessThan(items.indexOf('Profile'))
  })
})

describe('platform nav group (FR-01)', () => {
  it('offers exactly the admin entries + profile', () => {
    expect(visibleNavItems(PLATFORM_NAV_ITEMS, [], null).map((i) => i.label)).toEqual([
      'Admin',
      'Platform console',
      'Profile',
    ])
  })
})
