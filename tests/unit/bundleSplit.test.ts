/*
 * specs/038 T004 — the deterministic split-class assertion (FR-02/B3, the
 * clarified HARD gate): the build manifest proves that CUSTOMER-shell page
 * chunks import no staff/admin-only module ids and vice versa.
 *
 * This spec SKIPS when the manifest is absent (the unit tier must run on
 * any checkout). The T018 final gate runs `vite build` first, so the gate
 * run always has the manifest — the skip is a dev-convenience affordance,
 * never an escape hatch: the gate demands this file PASSED, not skipped,
 * and the standalone `npm run test:unit` on a fresh checkout runs it right
 * after the platform's own build step.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface ManifestEntry {
  file: string
  name: string
  imports?: string[]
  isEntry?: boolean
}

const MANIFEST = resolve(process.cwd(), 'dist/.vite/manifest.json')

/** The lazy PAGE entries, keyed by their manifest name (per-page chunks). */
const CUSTOMER_PAGE_NAMES = [
  'RootPage',
  'OrderPage',
  'RestaurantPublicPage',
  'CustomerMenuPage',
  'SignInPage',
  'ResetPasswordPage',
  'ChangePasswordPage',
]

const STAFF_PAGE_NAMES = [
  'DashboardPage',
  'ProfilePage',
  'StaffListPage',
  'StaffSessionsPage',
  'CashierRoundsPage',
  'KitchenDashboardPage',
  'AuditLogPage',
  'ReportsPage',
  'VoidReportPage',
  'ManageRestaurantPage',
  'MenuPage',
  'TaxPage',
  'BranchesPage',
  'BranchDetailPage',
  'BranchMenuPage',
  'BranchTaxPage',
]

const ADMIN_PAGE_NAMES = ['AdminPage', 'PlatformConsolePage']

/**
 * Modules that are ONLY reachable from staff/admin pages: their manifest
 * entry name is the source module's basename. A customer chunk importing
 * any of these is the split boundary broken.
 *
 * Kept as PAGE-graph facts (the shared component/helper vocabulary — ui/,
 * state family, queryClient, the sessionSurface vocabulary shared by the
 * customer flow and the staff oversight panel, and the supabase client — is
 * legitimately shared and must NOT trip the rule; the boundary is the
 * SHELL-specific feature code).
 */
const STAFF_ONLY_MARKERS = [
  'DashboardPage',
  'CashierRoundsPage',
  'KitchenDashboardPage',
  'StaffListPage',
  'StaffSessionsPage',
  'AuditLogPage',
  'ReportsPage',
  'VoidReportPage',
  'staffOps',
  'useStaffOps',
  'taxClient',
  'useTax',
  'managementClient',
]
const CUSTOMER_ONLY_MARKERS = ['CustomerMenuPage', 'OrderPage', 'useCart', 'cutoffState']

function entryImports(entry: ManifestEntry, manifest: Record<string, ManifestEntry>): string[] {
  const names: string[] = []
  const walk = (chunkKey: string, seen: Set<string>) => {
    if (seen.has(chunkKey)) return
    seen.add(chunkKey)
    const e: ManifestEntry | undefined = manifest[chunkKey]
    if (!e) return
    names.push(e.name)
    for (const dep of e.imports ?? []) walk(dep, seen)
  }
  for (const dep of entry.imports ?? []) walk(dep, new Set())
  return names
}

describe.skipIf(!existsSync(MANIFEST))('bundle split classes (spec 038 FR-02 — hard)', () => {
  const manifest: Record<string, ManifestEntry> = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const all = Object.values(manifest)

  it('every shell-side route page is its own chunk (splitting landed)', () => {
    const names = all.map((e) => e.name)
    for (const page of [...CUSTOMER_PAGE_NAMES, ...STAFF_PAGE_NAMES, ...ADMIN_PAGE_NAMES]) {
      expect(names, `missing chunk for ${page}`).toContain(page)
    }
  })

  it('customer page chunks import no staff-only module ids', () => {
    for (const name of CUSTOMER_PAGE_NAMES) {
      const entry = all.find((e) => e.name === name)
      const reachable = entry ? entryImports(entry, manifest) : []
      for (const marker of STAFF_ONLY_MARKERS) {
        expect(
          reachable.some((n) => n.toLowerCase().includes(marker.toLowerCase())),
          `${name} chunk must not reach ${marker}`,
        ).toBe(false)
      }
    }
  })

  it('staff page chunks import no customer-token-only module ids', () => {
    for (const name of STAFF_PAGE_NAMES) {
      const entry = all.find((e) => e.name === name)
      const reachable = entry ? entryImports(entry, manifest) : []
      for (const marker of CUSTOMER_ONLY_MARKERS) {
        expect(
          reachable.some((n) => n.toLowerCase().includes(marker.toLowerCase())),
          `${name} chunk must not reach ${marker}`,
        ).toBe(false)
      }
    }
  })

  it('admin page chunks import no customer-token-only module ids', () => {
    for (const name of ADMIN_PAGE_NAMES) {
      const entry = all.find((e) => e.name === name)
      const reachable = entry ? entryImports(entry, manifest) : []
      for (const marker of CUSTOMER_ONLY_MARKERS) {
        expect(
          reachable.some((n) => n.toLowerCase().includes(marker.toLowerCase())),
          `${name} chunk must not reach ${marker}`,
        ).toBe(false)
      }
    }
  })
})
