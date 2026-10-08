import { test } from '@playwright/test'
import { expectShellFloor, scanMatrixRow, type MatrixRow } from './helpers/a11y'

/**
 * The accessibility matrix (spec 035 FR-01/FR-09; T002/T003): every
 * registered route scanned in its authorized state — signed-out postures,
 * per-role staff surfaces, denial views, the Fiona bootstrap, the 404
 * catch-all — plus explicit shell-floor assertions (one #main landmark,
 * skip link first in tab order) on every page. Findings outside the
 * committed baseline (helpers/a11y.ts) fail; baseline entries carry a
 * written justification and an owning phase.
 *
 * The serial mode is deliberate: rows share seeded identities through the
 * real /signin form (the signInAs retry absorbs burst rate-limits), and
 * one worker keeps the matrix honest without cross-file locks.
 */

const MATRIX: MatrixRow[] = [
  // ── Customer shell: public + credential postures (signed-out). ──────────
  { route: '/', identity: null, shell: 'customer' },
  { route: '/signin', identity: null, shell: 'customer' },
  { route: '/reset-password', identity: null, shell: 'customer' },
  // The seeded public restaurant entry (the /r/:slug posture).
  { route: '/r/blue-olive', identity: null, shell: 'customer' },
  // The entry-gated menu state: the entry form's floor rides the shell.
  { route: '/r/blue-olive/menu', identity: null, shell: 'customer' },
  // The customer order deep link (branch parameterized by the Downtown id).
  {
    route: '/order/00000000-0000-4000-8000-000000000101',
    identity: null,
    shell: 'customer',
    note: 'order deep link',
  },
  // The staff deep link signed out redirects to /signin (the redirect
  // target's floor is what the visitor sees — scanned as-seen).
  { route: '/dashboard', identity: null, shell: 'customer', note: 'redirects to /signin' },
  // ── Staff shell: per-role authorized states. ────────────────────────────
  { route: '/dashboard', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/profile', identity: 'carla', shell: 'staff' },
  // The signed-in password change (customer shell, session bar visible).
  { route: '/account/password', identity: 'carla', shell: 'customer' },
  { route: '/dashboard/staff', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/sessions', identity: 'bob', shell: 'staff' },
  { route: '/dashboard/rounds', identity: 'carla', shell: 'staff' },
  { route: '/dashboard/kitchen', identity: 'dan', shell: 'staff' },
  { route: '/dashboard/audit', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/reports', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/voids', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/restaurant', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/menu', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/tax', identity: 'alice', shell: 'staff' },
  { route: '/dashboard/branches', identity: 'alice', shell: 'staff' },
  {
    route: '/dashboard/branches/00000000-0000-4000-8000-000000000101',
    identity: 'alice',
    shell: 'staff',
    note: 'branch detail (Downtown)',
  },
  {
    route: `/dashboard/branches/00000000-0000-4000-8000-000000000101/menu`,
    identity: 'alice',
    shell: 'staff',
    note: 'branch menu view',
  },
  {
    route: `/dashboard/branches/00000000-0000-4000-8000-000000000101/tax`,
    identity: 'alice',
    shell: 'staff',
    note: 'branch tax view',
  },
  { route: '/admin', identity: 'platformAdmin', shell: 'staff' },
  { route: '/admin/platform', identity: 'platformAdmin', shell: 'staff' },
  // The linked-profile bootstrap (no memberships) — Fiona, under her lock.
  { route: '/dashboard', identity: 'fiona', shell: 'staff', fionaLock: true },
  // ── Denial views (role-refused, as-seen — they disclose nothing new). ───
  { route: '/dashboard/staff', identity: 'bob', shell: 'staff', note: 'manager refused' },
  { route: '/dashboard/rounds', identity: 'dan', shell: 'staff', note: 'kitchen refused' },
  { route: '/dashboard/reports', identity: 'carla', shell: 'staff', note: 'cashier refused' },
  // The signed-in 404 catch-all (unknown path, inside the staff shell).
  { route: '/no-such-route', identity: 'carla', shell: 'staff', note: '404 catch-all' },
]

for (const row of MATRIX) {
  test(`a11y matrix: ${row.route}${row.identity ? ` as ${row.identity}` : ' (signed-out)'}${
    row.note ? ` — ${row.note}` : ''
  }`, async ({ page }) => {
    test.setTimeout(90_000)
    await scanMatrixRow(page, row)
    await expectShellFloor(page)
  })
}
