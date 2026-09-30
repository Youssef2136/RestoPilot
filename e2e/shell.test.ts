import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withFionaLock } from './helpers/fionaLock'

/**
 * Shell E2E (spec 023 T011; FR-01, FR-03, FR-09, FR-12; Gates).
 *
 * The shell CONTRACT in one file: the two-shells selection (no surface
 * renders both), one <main> landmark per shell, the staff persona nav
 * matrix through the sidebar, the mobile drawer through the same model,
 * the context switcher's session persistence, the confirm-dialog session
 * close (T007's migration), the offline banner's Retry arm, and sign-out.
 * Surface-level details stay with their own suites; this file proves the
 * chrome.
 *
 * NOTE (Playwright name matching): the switcher's labels are
 * "Viewing — Where"/"Viewing — Scope" BY DESIGN — accessible-name matching
 * is case-insensitive SUBSTRING, so "Restaurant"/"Branch" anywhere in a
 * shell label would collide with the pages' own selects (the T012 lesson).
 */

/** Asserts the staff sidebar nav renders exactly `labels` for this persona. */
async function expectNavLabels(page: Page, labels: string[]) {
  const nav = page.getByRole('navigation', { name: 'Staff area' })
  for (const label of labels) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible()
  }
}

test.describe('the two shells (FR-01, FR-12)', () => {
  test('the customer shell renders one main and no staff nav (the `/` contract)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
  })

  test('the staff shell renders exactly one main landmark with the skip link', async ({ page }) => {
    await signInAs(page, seedCredentials.alice)
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible()
  })
})

test.describe('the staff nav matrix through the sidebar (FR-02)', () => {
  test('an owner sees the operational, management, and reports groups', async ({ page }) => {
    await signInAs(page, seedCredentials.alice)
    await expectNavLabels(page, [
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
    ])
  })

  test('a cashier sees the operational group but no management or reports links', async ({
    page,
  }) => {
    await signInAs(page, seedCredentials.carla)
    const nav = page.getByRole('navigation', { name: 'Staff area' })
    await expect(nav.getByRole('link', { name: 'Rounds', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Staff list', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Audit trail', exact: true })).toHaveCount(0)
  })

  test('the active route carries aria-current on its nav link', async ({ page }) => {
    await signInAs(page, seedCredentials.carla)
    const rounds = page.getByRole('navigation', { name: 'Staff area' }).getByRole('link', {
      name: 'Rounds',
      exact: true,
    })
    await rounds.click()
    await expect(page).toHaveURL(/\/dashboard\/rounds$/)
    await expect(rounds).toHaveAttribute('aria-current', 'page')
  })

  test('the super admin sees the platform nav group, not the staff one', async ({ page }) => {
    await signInAs(page, seedCredentials.platformAdmin)
    await expect(page.getByRole('navigation', { name: 'Platform area' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Staff area' })).toHaveCount(0)
  })
})

test.describe('the mobile drawer (FR-09)', () => {
  test('below 1024px the nav renders only through the header menu button', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 })
    await signInAs(page, seedCredentials.carla)
    // Sidebar nav is hidden at this width; the drawer carries the model.
    await expect(page.getByRole('navigation', { name: 'Staff area' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    const rounds = drawer.getByRole('link', { name: 'Rounds', exact: true })
    await expect(rounds).toBeVisible()
    await rounds.click()
    await expect(page).toHaveURL(/\/dashboard\/rounds$/)
    // Navigation closes the drawer (it is a route-change affordance).
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('the context switcher (FR-03)', () => {
  test('the selection persists across routes and re-applies on navigation', async ({ page }) => {
    await signInAs(page, seedCredentials.alice)
    const where = page.getByLabel('Viewing — Where')
    await where.selectOption({ label: 'Blue Olive' })
    // Navigate away and back through the shell chrome itself.
    await page
      .getByRole('navigation', { name: 'Staff area' })
      .getByRole('link', { name: 'Rounds', exact: true })
      .click()
    await expect(page).toHaveURL(/\/dashboard\/rounds$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)
    // The sessionStorage-backed context re-applies: same selection.
    await expect(page.getByLabel('Viewing — Where')).toHaveValue(/.+/)
  })
})

test.describe('the confirm-dialog session close (T007 migration; FR-06, Q4)', () => {
  test('closing a session walks the two-step dialog and the names hold verbatim', async ({
    page,
    browser,
  }) => {
    // A fresh customer entry on the free seeded table so this test owns
    // its session (T3 is kept free by the seed for exactly this pattern).
    const guest = await browser.newPage()
    await guest.goto('/r/blue-olive')
    await guest.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await guest.getByLabel('Table').selectOption({ label: 'T3' })
    await guest.getByLabel('Your name').fill('Shell E2E Guest')
    await guest.getByLabel('Phone number').fill('+15557770001')
    await guest.getByRole('button', { name: 'Join the table' }).click()
    await expect(guest).toHaveURL(/\/r\/blue-olive\/menu$/)
    await guest.close()

    await signInAs(page, seedCredentials.alice)
    await page.goto('/dashboard/sessions')
    await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
    const row = page.getByRole('listitem').filter({ hasText: 'T3' }).first()
    // Step ONE: the card's button opens the dialog (same name as before).
    await row.getByRole('button', { name: 'Close session for T3' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Step TWO: the dialog's confirm keeps the inline flow's exact name.
    await dialog.getByRole('button', { name: 'Confirm closing T3' }).click()
    await expect(page.getByRole('status')).toContainText(/T3.s session was closed/)
  })
})

test.describe('the offline banner (FR-07, Q5)', () => {
  test('the offline flip shows the banner and Retry now refetches active queries', async ({
    page,
    context,
  }) => {
    await signInAs(page, seedCredentials.alice)
    // Go offline through the context: navigator.onLine flips and every
    // request fails — the banner's two triggers at once.
    await context.setOffline(true)
    await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry now' }).click()
    await context.setOffline(false)
    // Recovery: the banner reports the restored connection.
    await expect(page.getByText('Back online — live updates restored.')).toBeVisible()
  })
})

test.describe('sign-out (FR-01 header composition)', () => {
  test('signing out from the staff shell re-protects the staff area', async ({ page }) => {
    // The lock holds across the whole body (not just the sign-in): the
    // full-journey's creation flow can flip Fiona's membership mid-test,
    // and the poisoned-password window would kill the session outright.
    await withFionaLock(async () => {
      await signInAs(page, seedCredentials.fiona)
      await page.getByRole('button', { name: 'Sign out' }).click()
      await expect(page).toHaveURL(/\/signin$/)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/signin$/)
    })
  })
})
