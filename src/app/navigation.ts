import type { AuthContextMembership } from '../features/auth/useAuthContext'

/**
 * The ONE navigation-model declaration (spec 023 FR-02; Master Plan FA-5
 * applied to navigation): every staff-shell nav surface — the desktop
 * sidebar, the mobile drawer, and the dashboard home's operational
 * shortcuts — renders THIS list filtered by the member's effective
 * predicates. A second hand-written list anywhere is a defect.
 *
 * Visibility is presentation only (master plan §38; Constitution IV): the
 * pages' own gates and every RPC re-authorize regardless. A hidden entry
 * never implies a denied route renders content — deep links render the
 * NotAuthorized view exactly as before.
 *
 * Canonical order (spec 023 Clarification Q1): operational items lead
 * (the cashier/kitchen shift lands here), then configuration, then
 * oversight/analysis, then account.
 */

export type NavItem = {
  /** Route path (also the React Router `to`). */
  path: string
  /** Accessible name — E2E contract names; never reworded here. */
  label: string
  /** Group heading in the sidebar (rendered once per group). */
  group: 'operations' | 'configuration' | 'oversight' | 'account'
  /** Effective memberships + the selected restaurant decide visibility. */
  visible: (memberships: AuthContextMembership[], restaurantId: string | null) => boolean
}

/** owner or branch_manager of the restaurant (spec 004 FR-006 matrix). */
function isOwnerOrManager(
  memberships: AuthContextMembership[],
  restaurantId: string | null,
): boolean {
  return (
    restaurantId !== null &&
    memberships.some(
      (m) =>
        m.restaurant_id === restaurantId && (m.role === 'owner' || m.role === 'branch_manager'),
    )
  )
}

function isOwner(memberships: AuthContextMembership[], restaurantId: string | null): boolean {
  return (
    restaurantId !== null &&
    memberships.some((m) => m.restaurant_id === restaurantId && m.role === 'owner')
  )
}

function isMemberOf(memberships: AuthContextMembership[], restaurantId: string | null): boolean {
  return restaurantId !== null && memberships.some((m) => m.restaurant_id === restaurantId)
}

/** Operational roles for sessions/rounds (spec 007 FR-017 / spec 009 FR-005). */
function isOperational(memberships: AuthContextMembership[], restaurantId: string | null): boolean {
  return (
    restaurantId !== null &&
    memberships.some(
      (m) =>
        m.restaurant_id === restaurantId &&
        (m.role === 'owner' || m.role === 'branch_manager' || m.role === 'cashier'),
    )
  )
}

export const STAFF_NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    group: 'operations',
    visible: () => true,
  },
  {
    path: '/dashboard/sessions',
    label: 'Sessions',
    group: 'operations',
    visible: isOperational,
  },
  {
    path: '/dashboard/rounds',
    label: 'Rounds',
    group: 'operations',
    visible: isOperational,
  },
  {
    path: '/dashboard/kitchen',
    label: 'Kitchen',
    group: 'operations',
    // Every member of the restaurant sees the kitchen display entry (the
    // kitchen role's own surface; others' deep links still deny).
    visible: isMemberOf,
  },
  {
    path: '/dashboard/branches',
    label: 'Branches',
    group: 'configuration',
    visible: isMemberOf,
  },
  {
    path: '/dashboard/staff',
    label: 'Staff list',
    group: 'configuration',
    visible: isOwnerOrManager,
  },
  {
    path: '/dashboard/restaurant',
    label: 'Restaurant',
    group: 'configuration',
    visible: isOwner,
  },
  {
    path: '/dashboard/menu',
    label: 'Menu',
    group: 'configuration',
    visible: isOwner,
  },
  {
    path: '/dashboard/tax',
    label: 'Tax',
    group: 'configuration',
    visible: isOwner,
  },
  {
    path: '/dashboard/reports',
    label: 'Reports',
    group: 'oversight',
    visible: isOwnerOrManager,
  },
  {
    path: '/dashboard/voids',
    label: 'Void log',
    group: 'oversight',
    visible: isOwnerOrManager,
  },
  {
    path: '/dashboard/audit',
    label: 'Audit trail',
    group: 'oversight',
    visible: isOwnerOrManager,
  },
  {
    path: '/dashboard/profile',
    label: 'Profile',
    group: 'account',
    visible: () => true,
  },
]

/** The platform nav group (the staff shell's variant for super admins). */
export const PLATFORM_NAV_ITEMS: NavItem[] = [
  {
    path: '/admin',
    label: 'Admin',
    group: 'operations',
    visible: () => true,
  },
  {
    path: '/admin/platform',
    label: 'Platform console',
    group: 'operations',
    visible: () => true,
  },
  {
    path: '/dashboard/profile',
    label: 'Profile',
    group: 'account',
    visible: () => true,
  },
]

/** Filter the model for a member's effective restaurant context. */
export function visibleNavItems(
  items: NavItem[],
  memberships: AuthContextMembership[],
  restaurantId: string | null,
): NavItem[] {
  return items.filter((item) => item.visible(memberships, restaurantId))
}
