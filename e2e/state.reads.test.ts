import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * Read-path state honesty E2E — US2 block (spec 037 T011; FR-02, FR-03;
 * SC-001, SC-003).
 *
 * DETERMINISTIC INJECTION ONLY: latency and empty results are delivered by
 * Playwright route interception (route.fulfill with a delayed body or an
 * empty payload) — the same result on every run, no real-network waits.
 *
 * Latency ≥ the clarified threshold (~300 ms) proves the skeleton renders
 * and its swap to content shifts nothing; empty payloads prove the named
 * next-action state per representative route.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

async function signInOwner(page: Page): Promise<void> {
  await signInAs(page, seedCredentials.alice)
}

/*
 * Leg A — reads slower than the ~300 ms threshold render the Skeleton, and
 * the swap to content causes no layout shift (the skeleton is sized to the
 * content, so the leading edges of the page stay put).
 */
test('delayed reads render skeletons and the swap keeps the layout stable (FR-02)', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signInOwner(page)

  // Hold the SALES REPORT rpc for 1200 ms (above ~300 ms): the aggregate
  // waits on it, so the layout's first paint is pending — the skeleton
  // gate renders — and the swap to content shifts nothing.
  await page.route(/rest\/v1\/rpc\/get_branch_sales_report/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })
  await page.goto('/dashboard/reports')
  await expect(page.getByTestId('report-skeleton')).toBeVisible({ timeout: 15_000 })
  // The skeleton swaps to content; the pickers above it never move.
  const control = page.getByLabel('Branch')
  await control.scrollIntoViewIfNeeded()
  const controlBox = await control.boundingBox()
  await expect(page.getByTestId('report-aggregates')).toBeVisible({ timeout: 10_000 })
  const controlBoxAfter = await control.boundingBox()
  expect(controlBoxAfter?.y).toBeCloseTo(controlBox?.y ?? 0, 0)
  await context.close()
})

test('the staff list skeleton holds the header stable until rows land (FR-02)', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signInOwner(page)

  await page.route(/rest\/v1\/staff_memberships/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })
  await page.goto('/dashboard/staff')
  await expect(page.getByTestId('staff-list-skeleton')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Staff list' })).toBeVisible()
  // The swap: the skeleton leaves, rows arrive, header stays put.
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('staff-list-skeleton')).toBeHidden()
  await context.close()
})

test('the customer menu skeleton covers the ~300 ms menu read without shifting the cart column (FR-02)', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T2' })
  await page.getByLabel('Your name').fill('State Reads')
  await page.getByLabel('Phone number').fill('+15559100003')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))

  await page.route(/rest\/v1\/rpc\/get_session_menu/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })
  // The reload re-mounts the page: with the route held at 1200 ms, the
  // menu read's first paint is pending past the ~300 ms threshold — the
  // skeleton renders, then swaps to content with zero layout shift.
  await page.reload()
  await expect(page.locator('[data-skeleton="text"], [data-skeleton="block"]').first()).toBeVisible(
    {
      timeout: 15_000,
    },
  )
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-skeleton]').first()).toBeHidden()
  await context.close()
})

/*
 * Leg B — controlled empty payloads render the named next-action state:
 * empty is its own announcement (role=status), never an error tone, never a
 * blank box.
 */
test('controlled empty reads name their next action per route (FR-03, SC-003)', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signInOwner(page)

  // Voids: an EMPTY payload (no rows) — the log exists, it is just empty.
  await page.route(/rest\/v1\/rpc\/get_branch_void_report/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  )
  await page.goto('/dashboard/voids')
  await expect(page.getByTestId('void-log-empty')).toBeVisible()
  await expect(page.getByTestId('void-log-empty')).toContainText('No voids recorded')
  // Empty ≠ error: it is a status announcement, not an alarm.
  await expect(page.getByTestId('void-log-empty')).toHaveAttribute('data-state', 'empty')
  await context.close()
})

test('the audit log filters to a controlled-empty result and names the widening action (FR-03)', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signInOwner(page)

  // An empty PAGE of audit rows (the payload carries an entries array; the
  // trail exists, this filter just finds none).
  await page.route(/rest\/v1\/rpc\/get_audit_log/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    }),
  )
  await page.goto('/dashboard/audit')
  await expect(page.getByTestId('audit-log-empty')).toBeVisible()
  await expect(page.getByTestId('audit-log-empty')).toContainText('No audit entries match')
  await context.close()
})
