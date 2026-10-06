import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { withEntryLock } from './helpers/entryLock'
import { signInAs } from './helpers/signInAs'
import { withSubscriptionLock } from './helpers/subscriptionLock'

/**
 * Platform console UX E2E (specs/034; Master Plan §Frontend Phase 14,
 * FR-01/FR-02/FR-07 + R6). The console presentation layer on top of the
 * frozen surfaces suite: the workable tenant list (filter + sort, D3),
 * every action speaking its outcome through a toast (D2), and the
 * responsive/a11y floor — the axe scan on both /admin routes plus labelled
 * card rows at 390px (D5/D6).
 *
 * Locking discipline (the house pattern): the Blue Olive date flip rides
 * the shared subscriptions-row lock and restores active (+30) before
 * releasing; the Cedar Grill disable→re-enable window rides the entry lock
 * (session.surfaces drives Cedar Grill's public entry, so even this
 * short kill-switch window must hold it). Nothing else writes, and Cedar
 * Grill's DATES are never touched — its dateless row is the suite's
 * 'Activate' reserve.
 *
 * File order note: this file sorts between live.awareness and
 * platform.surfaces — the date journey assumes Blue Olive's row may offer
 * either 'Activate' (dateless) or 'Change dates' (after live.awareness's
 * journey); the matcher accepts both and both ends restored to active
 * (+30), so the frozen suite's own journeys land unchanged.
 */

test.describe.configure({ mode: 'serial' })

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** The rows' tenant names, stripped of the disabled suffix (' — disabled…'). */
async function rowNames(page: Page): Promise<string[]> {
  const texts = await page
    .getByTestId('platform-overview')
    .locator('tbody td[data-label="Restaurant"]')
    .allInnerTexts()
  return texts.map((t) => t.split('—')[0]!.trim())
}

test('the tenant list is workable: filter + sort (FR-02, D3)', async ({ page }) => {
  test.setTimeout(90_000)
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  const table = page.getByTestId('platform-overview')
  await expect(table).toBeVisible()

  // Filter: a case-insensitive substring narrows the rows client-side
  // (FR-10 — no new reads; unmatched rows leave the DOM entirely).
  const filter = page.getByLabel('Filter tenants')
  await filter.fill('cedar')
  await expect(table).toContainText('Cedar Grill')
  await expect(table).not.toContainText('Blue Olive')
  await filter.fill('')
  await expect(table).toContainText('Blue Olive')

  // Sort: the Name header toggles ascending → descending (aria-sort), and
  // the rendered order matches the locale order of the rows present —
  // self-consistent whatever tenants earlier suites onboarded.
  const nameHeader = table.getByRole('button', { name: 'Restaurant' })
  await nameHeader.click()
  await expect(table.locator('th').first()).toHaveAttribute('aria-sort', 'ascending')
  let names = await rowNames(page)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

  await nameHeader.click()
  await expect(table.locator('th').first()).toHaveAttribute('aria-sort', 'descending')
  names = await rowNames(page)
  expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)))
})

test('every action speaks: dates saved, tenant disabled, tenant re-enabled (FR-07, D2)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const notifications = page.getByRole('region', { name: 'Notifications' })

  // The Blue Olive date flip rides the shared subscriptions-row lock and
  // restores active (+30) before releasing (the live.awareness discipline).
  await withSubscriptionLock(async () => {
    await signInAs(page, seedCredentials.platformAdmin)
    await page.goto('/admin/platform')
    const table = page.getByTestId('platform-overview')
    await expect(table).toBeVisible()
    const oliveRow = table.locator('tbody tr', { hasText: 'Blue Olive' })
    await oliveRow.getByRole('button', { name: /Activate|Change dates/ }).click()

    const today = new Date()
    const in10 = new Date()
    in10.setUTCDate(in10.getUTCDate() + 10)
    await page.getByLabel('Start date').fill(iso(today))
    await page.getByLabel('End date').fill(iso(in10))
    await page.getByRole('button', { name: 'Save dates' }).click()
    await expect(notifications).toContainText('Subscription dates saved for Blue Olive.')

    // Restore active (+30) so downstream suites see the neutral tenant —
    // the row's end date proves the second write landed regardless of any
    // concurrent kill-switch rendering.
    await oliveRow.getByRole('button', { name: 'Change dates' }).click()
    const in30 = new Date()
    in30.setUTCDate(in30.getUTCDate() + 30)
    await page.getByLabel('Start date').fill(iso(today))
    await page.getByLabel('End date').fill(iso(in30))
    await page.getByRole('button', { name: 'Save dates' }).click()
    await expect(oliveRow).toContainText(iso(in30))
  })

  // The kill-switch window rides the entry lock (session.surfaces drives
  // Cedar Grill's public entry). Disable → reason → confirm speaks; the
  // reason shows in the row; re-enable speaks and clears it.
  await withEntryLock(async () => {
    const table = page.getByTestId('platform-overview')
    const cedarRow = table.locator('tbody tr', { hasText: 'Cedar Grill' })
    await expect(cedarRow).toBeVisible()

    await cedarRow.getByRole('button', { name: 'Disable', exact: true }).click()
    await page.getByLabel('Reason (required)').fill('E2E: console UX suspension')
    await page.getByRole('button', { name: 'Confirm disable' }).click()
    await expect(notifications).toContainText(
      'Cedar Grill was disabled — hosted actions stop; existing captured data is kept.',
    )
    await expect(cedarRow).toContainText('E2E: console UX suspension')

    await cedarRow.getByRole('button', { name: 'Re-enable' }).click()
    await expect(notifications).toContainText(
      'Cedar Grill was re-enabled — customers can order again.',
    )
    await expect(cedarRow).not.toContainText('E2E: console UX suspension')
  })
})

test('the console floor: axe on both admin routes and labelled cards at 390px (D5/D6)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, seedCredentials.platformAdmin)

  // D5 — the landing posture rides the same overview query (FR-01).
  await page.goto('/admin')
  await expect(page.getByText(/Platform posture:/)).toBeVisible()
  await expectNoNewViolations(page, { route: '/admin' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0)

  // D6 — the console table adopts the shared card-fallback pattern: below
  // 720px the thead leaves the flow and every cell states its own label.
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/admin/platform')
  const table = page.getByTestId('platform-overview')
  await expect(table).toBeVisible()
  await expectNoNewViolations(page, { route: '/admin/platform' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0)
  await expect(table).toHaveClass(/cardTable/)
  await expect(table.locator('td[data-label="Restaurant"]').first()).toBeVisible()
  await expect(table.locator('thead')).not.toBeVisible()
})
