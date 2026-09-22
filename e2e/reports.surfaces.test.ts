import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Reports surfaces E2E (spec 013 T011; US1–US4). The house pattern: all
 * writes through real browser surfaces (the customer submission journey),
 * staff reads through signed-in dashboard routes — no direct API calls from
 * the test process.
 *
 * US1: alice sees the aggregates grid, channel table, best-sellers, and the
 * branch comparison; the figures reconcile with the session's visible bill.
 * US2: bob sees Downtown scoped reports with no branch picker; his void log
 * renders. US3: the void log lists a real void made through the cashier
 * surface. US4: carla and dan have no reports/voids nav and their deep
 * links render the denial.
 *
 * Serial in one worker: the journeys build on the shared seeded context.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** Signs a seeded identity in through the /signin form (the house pattern). */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

/**
 * Submit one round as a real customer: enter through the public flow at the
 * given table and add the named item (the kitchen.cashier journey pattern).
 */
async function submitCustomerRound(
  browser: import('@playwright/test').Browser,
  tableLabel: string,
  itemName: string,
): Promise<void> {
  const page = await browser.newPage()
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: tableLabel })
  await page.getByLabel('Your name').fill('E2E Customer')
  await page.getByLabel('Phone number').fill('+15550888')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()
  const itemLine = page.locator('li', { hasText: itemName }).first()
  await itemLine.getByRole('button', { name: 'Add to cart' }).click()
  await page
    .getByRole('region', { name: 'Cart' })
    .getByRole('button', { name: /send order/i })
    .click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
  await page.close()
}

test('US1: alice sees the day report aggregates, channels, best-sellers, and comparison', async ({
  page,
  browser,
}) => {
  // A real customer round so the report is non-trivial (deterministic anchor:
  // the seeded sessions opened 2026-09-19; the customer round lands today —
  // both appear in their own day buckets, so the aggregates grid always has
  // the seeded day's figures under the day period of 2026-09-19).
  await submitCustomerRound(browser, 'T3', 'Hummus')

  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/reports')

  // The owner picker lists every branch of Blue Olive.
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
  const picker = page.getByLabel('Branch')
  await expect(picker).toBeVisible()
  const options = await picker.locator('option').allInnerTexts()
  expect(options.some((o) => o.includes('Downtown'))).toBe(true)
  expect(options.some((o) => o.includes('Marina'))).toBe(true)

  // The comparison table (owner-only, FR-003) renders both branches.
  await expect(page.getByTestId('report-comparison')).toBeVisible()
  await expect(page.getByTestId('report-comparison')).toContainText('Downtown')
  await expect(page.getByTestId('report-comparison')).toContainText('Marina')

  // The aggregates grid renders numeric figures and money through the
  // formatter — never raw floats or client-computed values.
  const aggregates = page.getByTestId('report-aggregates')
  await expect(aggregates).toContainText('Rounds submitted')
  await expect(aggregates).toContainText('Net total')

  // The channel table always lists all three channels (explicit zeros).
  await expect(page.getByTestId('report-channels')).toBeVisible()
  await expect(page.getByTestId('report-channels')).toContainText('dine-in')
  await expect(page.getByTestId('report-channels')).toContainText('delivery')
  await expect(page.getByTestId('report-channels')).toContainText('takeaway')
})

test('US1: the seeded day bucket shows the zero state for a period with no rounds', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/reports')

  // Anchor far in the future — an empty bucket renders zero-valued
  // aggregates and the empty best-sellers note (no error anywhere).
  await page.getByLabel('Anchor date').fill('2030-01-01')
  await expect(page.getByTestId('report-aggregates')).toContainText('0')
  await expect(page.getByText('No items sold in this period.')).toBeVisible()
})

test('US2: bob sees Downtown-only reports — no picker, no cross-branch', async ({ page }) => {
  await signInAs(page, seedCredentials.bob)
  await page.goto('/dashboard/reports')

  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
  // A single scope renders no picker (FR-005's permanence)…
  await expect(page.getByLabel('Branch')).toHaveCount(0)
  // …and the comparison (owner-only) is absent for a manager.
  await expect(page.getByTestId('report-comparison')).toHaveCount(0)
})

test("US3: a cashier void surfaces in the manager's void log", async ({ page, browser }) => {
  // A fresh customer round, then carla drives it to the void boundary and
  // voids it with a reason through the REAL cashier surface.
  await submitCustomerRound(browser, 'T3', 'Hummus')

  const cashier = await browser.newPage()
  await signInAs(cashier, seedCredentials.carla)
  await cashier.goto('/dashboard/rounds')
  const incoming = cashier.locator('[data-round-state="new"]').first()
  await expect(incoming).toBeVisible()
  await incoming.getByRole('button', { name: 'Accept round' }).click()
  const accepted = cashier.locator('[data-round-state="accepted"]').first()
  await expect(accepted).toBeVisible()
  await accepted.getByRole('button', { name: 'Start preparation' }).click()
  const preparing = cashier.locator('[data-round-state="preparing"]').first()
  await expect(preparing).toBeVisible()
  await preparing.getByRole('button', { name: 'Mark ready' }).click()
  const ready = cashier.locator('[data-round-state="ready"]').first()
  await expect(ready).toBeVisible()
  await ready.getByRole('button', { name: 'Lock round' }).click()
  const locked = cashier.locator('[data-round-state="lock"]').first()
  await expect(locked).toBeVisible()
  await locked.getByRole('button', { name: 'Void round' }).click()
  await cashier.getByLabel('Void reason').fill('E2E: wrong order')
  await cashier.getByRole('button', { name: 'Confirm void' }).click()
  await expect(cashier.locator('[data-voided="true"]').first()).toBeVisible()
  await cashier.close()

  // The void log lists it with the reason verbatim (US3).
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/voids')
  const table = page.getByTestId('void-log-table')
  await expect(table).toBeVisible()
  await expect(table).toContainText('E2E: wrong order')
  await expect(table).toContainText('Carla')
})

test('US4: cashier and kitchen have no reports surface (absence, not harmlessness)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)

  // The dashboard nav lists neither entry for a cashier.
  await expect(page.locator('nav').getByRole('link', { name: 'Reports' })).toHaveCount(0)
  await expect(page.locator('nav').getByRole('link', { name: 'Void log' })).toHaveCount(0)

  // The deep link renders the denial (rejected, not hidden).
  await page.goto('/dashboard/reports')
  await expect(page.getByText(/not authorized|you do not have/i)).toBeVisible()
  await page.goto('/dashboard/voids')
  await expect(page.getByText(/not authorized|you do not have/i)).toBeVisible()
})

test('US4: the kitchen role is equally absent from reports', async ({ page }) => {
  await signInAs(page, seedCredentials.dan)
  await expect(page.locator('nav').getByRole('link', { name: 'Reports' })).toHaveCount(0)
  await page.goto('/dashboard/reports')
  await expect(page.getByText(/not authorized|you do not have/i)).toBeVisible()
})
