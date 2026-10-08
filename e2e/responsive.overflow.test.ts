import { expect, test, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'
import { expectNoHorizontalOverflow, setViewport, type ViewportKey } from './helpers/responsive'

/**
 * The overflow sweep (spec 036 FR-03/SC-002, W1): every registered route in
 * its authorized state at 320/390/430 px — the scrolling element must not
 * overflow horizontally and no rendered element may extend past the
 * viewport's right edge (helpers/responsive.ts). Content present is the
 * seeded real content (menu items, table rows, denial copies) — the surfaces'
 * realistic states, not empty shells.
 *
 * Serial like the a11y matrix: rows share the seeded identities through the
 * real /signin form (5 sign-ins — one per identity, routes loop inside),
 * and the guest menu leg joins a seeded table under its locks.
 */

test.describe.configure({ mode: 'serial' })

const WIDTHS: ViewportKey[] = ['mobile320', 'mobile390', 'mobile430']

/** Navigate and assert no horizontal overflow at the current viewport. */
async function sweepCurrentPage(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await expectNoHorizontalOverflow(page)
}

test('the public routes hold 320/390/430 without horizontal overflow', async ({ page }) => {
  test.setTimeout(240_000)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, [
      '/',
      '/signin',
      '/reset-password',
      '/r/blue-olive',
      '/r/blue-olive/menu',
      // The C1 deep link redirects to the landing with the branch echo —
      // the landing is what renders, so the landing is what must fit.
      `/order/${branchIds.downtown}`,
      // The signed-out staff deep link redirects to /signin (as-seen).
      '/dashboard',
    ])
  }
})

test('the owner routes hold 320/390/430 without horizontal overflow', async ({ page }) => {
  test.setTimeout(300_000)
  await signInAs(page, seedCredentials.alice)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, [
      '/dashboard',
      '/dashboard/staff',
      '/dashboard/audit',
      '/dashboard/reports',
      '/dashboard/voids',
      '/dashboard/restaurant',
      '/dashboard/menu',
      '/dashboard/tax',
      '/dashboard/branches',
      `/dashboard/branches/${branchIds.downtown}`,
      `/dashboard/branches/${branchIds.downtown}/menu`,
      `/dashboard/branches/${branchIds.downtown}/tax`,
    ])
  }
})

test('the cashier routes hold 320/390/430 without horizontal overflow', async ({ page }) => {
  test.setTimeout(240_000)
  await signInAs(page, seedCredentials.carla)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, [
      '/dashboard/profile',
      '/dashboard/rounds',
      '/account/password',
      // Denial views are real rendered surfaces — they fit too.
      '/dashboard/reports',
      '/no-such-route',
    ])
  }
})

test('the manager and kitchen routes hold 320/390/430 without horizontal overflow', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await signInAs(page, seedCredentials.bob)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, ['/dashboard/sessions'])
  }
  await signInAs(page, seedCredentials.dan)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, ['/dashboard/kitchen', '/dashboard/rounds'])
  }
})

test('the platform routes hold 320/390/430 without horizontal overflow', async ({ page }) => {
  test.setTimeout(240_000)
  await signInAs(page, seedCredentials.platformAdmin)
  for (const width of WIDTHS) {
    await setViewportAndSweep(page, width, ['/admin', '/admin/platform'])
  }
})

test('the in-session customer menu (with cart content) holds 320/390/430', async ({ page }) => {
  test.setTimeout(300_000)
  await withT2Lock(async () => {
    await withEntryLock(async () => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/r/blue-olive')
      await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
      await page.getByLabel('Table').selectOption({ label: 'T2' })
      await page.getByLabel('Your name').fill('Overflow Sweep Guest')
      await page.getByLabel('Phone number').fill('+15557477003')
      await page.getByRole('button', { name: 'Join the table' }).click()
    })
    await expect(page).toHaveURL(/\/r\/blue-olive\/menu$/)
    // Cart content: the revenue surface's real state.
    const kebab = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await kebab.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByText('Hummus added to your cart.')).toBeVisible()

    for (const width of WIDTHS) {
      await setViewport(page, width)
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalOverflow(page)
    }
  })
})

/* ── helpers ──────────────────────────────────────────────────────────── */

async function setViewportAndSweep(
  page: Page,
  width: ViewportKey,
  routes: string[],
): Promise<void> {
  await setViewport(page, width)
  for (const route of routes) {
    await sweepCurrentPage(page, route)
  }
}
