/**
 * Route metadata registry (spec 021 FR-02 / US2): every registered path with
 * its document title and meta description, applied centrally by
 * RouteTitles — never scattered through pages.
 *
 * Titles are user-facing browser-history labels; descriptions describe the
 * route's purpose for the document head. The registry is the single
 * declaration point the shell (Phase 03) and every surface phase consume.
 *
 * Dynamic segments use `:param` patterns matched by routeMetaFor().
 *
 * IMPORTANT: this module contains NO build-mode logic. It is imported by E2E
 * specs (transpiled by Playwright WITHOUT Vite's defines) and must stay
 * statically analyzable so the dev gallery (router.tsx, behind Vite's
 * statically-replaced `import.meta.env.DEV`) is dead-code-eliminated from
 * production bundles — the gallery's registry entry lives in router.tsx and
 * is passed to RouteTitles as `extraRoutes` (spec 021 FR-09).
 */

export type RouteMeta = {
  /** Path pattern as registered in router.tsx (`:param` for dynamic segments). */
  path: string
  /** Document title (the tab/history label). */
  title: string
  /** Meta description (the route's one-line purpose). */
  description: string
}

/**
 * Every registered product route (25) in registration order. The dev
 * gallery's registry entry lives in router.tsx (DEV-gated) and reaches this
 * module only through routeMetaFor's `extraRoutes` parameter.
 */
export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    title: 'RestoPilot',
    description:
      "RestoPilot — guests order from the restaurant's own page; staff sign in to their dashboard.",
  },
  {
    path: '/order/:branchId',
    title: 'RestoPilot',
    description:
      "Old order links redirect to the RestoPilot landing — open the restaurant's page from its QR code.",
  },
  {
    path: '/signin',
    title: 'Staff sign-in',
    description: 'Sign in to the RestoPilot staff area, or request a password recovery link.',
  },
  {
    path: '/r/:slug',
    title: 'Restaurant entry',
    description: 'Enter a restaurant: pick your branch, table, or channel to start a session.',
  },
  {
    path: '/r/:slug/menu',
    title: 'Menu',
    description: 'The session menu: browse, cart, and order rounds; track your order status.',
  },
  {
    path: '/reset-password',
    title: 'Password recovery',
    description: 'Set a new password from your recovery link.',
  },
  {
    path: '/account/password',
    title: 'Account password',
    description: 'Change your own password after verifying the current one.',
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    description: 'The staff dashboard: restaurant context, branches, and operational shortcuts.',
  },
  { path: '/dashboard/profile', title: 'Profile', description: 'Your staff profile.' },
  {
    path: '/dashboard/staff',
    title: 'Staff',
    description: 'Manage staff members and their roles.',
  },
  {
    path: '/dashboard/sessions',
    title: 'Sessions',
    description: 'Open sessions across your branches, with close oversight.',
  },
  {
    path: '/dashboard/rounds',
    title: 'Rounds',
    description: 'The live rounds queue: accept, prepare, serve, modify, void, and bill.',
  },
  {
    path: '/dashboard/kitchen',
    title: 'Kitchen',
    description: 'The kitchen display: preparation tickets across their states.',
  },
  {
    path: '/dashboard/audit',
    title: 'Audit',
    description: 'The audit trail of privileged actions.',
  },
  {
    path: '/dashboard/reports',
    title: 'Reports',
    description: 'Per-branch sales aggregates and comparisons.',
  },
  {
    path: '/dashboard/voids',
    title: 'Voids',
    description: 'The void ledger: every voided round and its reason.',
  },
  {
    path: '/dashboard/restaurant',
    title: 'Restaurant',
    description: 'Restaurant profile, settings, QR, working hours, tables, and staff.',
  },
  {
    path: '/dashboard/menu',
    title: 'Menu management',
    description: 'Categories, items, extras, pricing, images, and availability.',
  },
  {
    path: '/dashboard/tax',
    title: 'Tax rules',
    description: 'Restaurant tax rules, compounds, and ordering.',
  },
  {
    path: '/dashboard/branches',
    title: 'Branches',
    description: 'Your readable branches and their detail views.',
  },
  {
    path: '/dashboard/branches/:branchId',
    title: 'Branch detail',
    description: 'A branch: detail, tables, sessions, and live activity.',
  },
  {
    path: '/dashboard/branches/:branchId/menu',
    title: 'Branch menu',
    description: 'The branch menu as customers see it.',
  },
  {
    path: '/dashboard/branches/:branchId/tax',
    title: 'Branch tax',
    description: 'The branch effective tax configuration and overrides.',
  },
  { path: '/admin', title: 'Admin', description: 'The platform admin landing.' },
  {
    path: '/admin/platform',
    title: 'Platform console',
    description: 'Restaurants, subscriptions, onboarding, and platform availability.',
  },
]

/**
 * Registry lookup for a concrete pathname. Exact match first, then a
 * parametric match against the `:param` patterns. Returns the matching meta
 * or undefined (unknown paths render the 404 view; their title is handled
 * there). `extraRoutes` lets the router extend the universe in DEV builds
 * (the gallery) without this module carrying any build-mode logic.
 */
export function routeMetaFor(
  pathname: string,
  extraRoutes: RouteMeta[] = [],
): RouteMeta | undefined {
  const universe = extraRoutes.length > 0 ? [...ROUTES, ...extraRoutes] : ROUTES
  const exact = universe.find((route) => route.path === pathname)
  if (exact) return exact

  const seg = (p: string) => p.split('/').filter(Boolean)
  const actual = seg(pathname)
  for (const route of universe) {
    if (!route.path.includes(':')) continue
    const pattern = seg(route.path)
    if (pattern.length !== actual.length) continue
    if (pattern.every((p, i) => p.startsWith(':') || p === actual[i])) {
      return route
    }
  }
  return undefined
}
