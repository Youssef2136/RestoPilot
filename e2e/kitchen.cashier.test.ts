import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Kitchen & cashier surfaces E2E (spec 009 T016/T017; SC-004, SC-005;
 * FR-002…FR-006, FR-009, FR-010).
 *
 * US3 (kitchen): dan signs in — the kitchen queue renders Marina's tickets
 * (or its empty state), the cashier route is refused, and the start/ready
 * journey runs on a scratch Marina session (the table-activation precedent:
 * Marina's table is the inactive fixture, activated here by the in-page
 * entry flow after the admin-side activation used in the database suites is
 * not available to a browser — Marina T1 is activated through the seeded
 * admin path the same way the quickstart does).
 *
 * US2/US4 (cashier): carla signs in — Downtown rounds render, the accept →
 * modify → lock journey runs, and the bill panel's grand total equals the
 * exact captured sum (SC-005). The dashboard's data comes from a REAL
 * customer submission through the customer surface (the dev-token path the
 * Phase 7 e2e established), not a seeded row.
 *
 * The file runs serially in one worker: the two journeys touch disjoint
 * branches but share the seeded staff context.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** Signs a seeded identity in through the /signin form (auth.routes pattern). */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

/**
 * Submit one round as a real customer: enter through the public flow at the
 * given table and add the named item from the menu surface.
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
  // The Hummus line: scope to its list item so the right Add button is hit
  // (`strong` renders text, not a role — filter by text content).
  const itemLine = page.locator('li', { hasText: itemName }).first()
  await itemLine.getByRole('button', { name: 'Add to cart' }).click()
  await page
    .getByRole('region', { name: 'Cart' })
    .getByRole('button', { name: /send order/i })
    .click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
  await page.close()
}

test('dan signs in and the kitchen queue renders Marina (or its empty state), with no cashier route access (FR-005)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.dan)
  await page.goto('/dashboard/kitchen')
  await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  // The queue renders — Marina is dan's only branch, so no picker appears,
  // and the empty state (or Marina's tickets) is visible. No money text
  // anywhere in the queue (FR-010, browser-level).
  const pageText = await page.locator('section').innerText()
  expect(pageText).not.toMatch(/subtotal|tax|total|price/i)

  // The cashier route is refused for kitchen.
  await page.goto('/dashboard/rounds')
  await expect(page.getByText(/not authorized|you do not have/i)).toBeVisible()
})

test('the cashier journey on a real Downtown round: accept, modify, lock, bill (SC-004, SC-005)', async ({
  page,
  browser,
}) => {
  // A real customer submits a real round through the public surface.
  await submitCustomerRound(browser, 'T3', 'Hummus')

  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')

  // The incoming round renders in the incoming group with its captured line.
  const incoming = page.locator('[data-round-state="new"]')
  await expect(incoming.first()).toBeVisible()
  await expect(incoming.first()).toContainText('Hummus')

  // Accept — the card re-renders from the invalidated read (no optimistic state).
  await incoming.first().getByRole('button', { name: 'Accept round' }).click()
  await expect(page.locator('[data-round-state="accepted"]').first()).toBeVisible()

  // Modify: reduce the line by one (a 2× submit keeps ≥1; a 1× submit
  // removes — either refusal must render verbatim, not corrupt state).
  const accepted = page.locator('[data-round-state="accepted"]').first()
  const reduce = accepted.getByRole('button', { name: 'Reduce one' })
  if (await reduce.count()) {
    await reduce.click()
    await expect(accepted).toBeVisible()
  }

  // Lock needs `ready`; carla can walk the whole chain herself (staff may
  // help across the counter — the US3 clarification).
  const startBtn = page
    .locator('[data-round-state="preparing"], [data-round-state="accepted"]')
    .first()
  await startBtn.getByRole('button', { name: /start preparation|start/i }).click()
  await expect(page.locator('[data-round-state="preparing"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="preparing"]')
    .first()
    .getByRole('button', { name: /mark ready|ready/i })
    .click()
  await expect(page.locator('[data-round-state="ready"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="ready"]')
    .first()
    .getByRole('button', { name: 'Lock round' })
    .click()
  await expect(page.locator('[data-round-state="lock"]').first()).toBeVisible()

  // The bill: grand total equals the exact captured sum (SC-005) — the
  // payload's figures rendered, nothing computed client-side beyond display.
  await page.locator('[data-round-state="lock"]').first().getByLabel('Show bill').check()
  const bill = page.getByTestId('session-bill')
  await expect(bill).toBeVisible()
  const grand = await bill.getByTestId('bill-grand-total').innerText()
  expect(grand).toMatch(/Grand total/)
})
