import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Platform surfaces E2E (spec 014 T011; FR-001–FR-010). The house pattern:
 * writes through real browser surfaces, reads through signed-in routes.
 *
 * The super admin drives the console: every restaurant visible with its
 * state, dates set (activate), disable with reason, re-enable. A tenant
 * sees the banners (expired informational, disabled). Non-flag identities
 * get the /admin denial. The disabled restaurant's customer entry refuses.
 *
 * Serial in one worker: the tests share one subscription lifecycle.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

test('the platform console lists every restaurant for the super admin (FR-001, FR-008)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.goto('/admin/platform')

  const table = page.getByTestId('platform-overview')
  await expect(table).toBeVisible()
  await expect(table).toContainText('Blue Olive')
  await expect(table).toContainText('Cedar Grill')
  // Usage figures render as plain counts (the slash-joined group).
  await expect(table).toContainText('/')
  // Never-activated is a visible state for the seeded restaurants.
  await expect(table).toContainText('Never activated')
})

test('the super admin activates a subscription and the state derives (FR-003/FR-004)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')

  // Activate Blue Olive: today → +30 days = active.
  await page.getByRole('button', { name: 'Activate' }).first().click()
  const today = new Date()
  const in30 = new Date()
  in30.setUTCDate(in30.getUTCDate() + 30)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  await page.getByLabel('Start date').fill(iso(today))
  await page.getByLabel('End date').fill(iso(in30))
  await page.getByRole('button', { name: 'Save dates' }).click()
  await expect(page.getByTestId('platform-overview')).toContainText('Active')
})

test("an expired subscription shows the tenant banner but doesn't block (FR-007, FR-010)", async ({
  page,
}) => {
  // Drive the subscription past its end as the super admin.
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  await page.getByRole('button', { name: 'Change dates' }).first().click()
  const past30 = new Date()
  past30.setUTCDate(past30.getUTCDate() - 30)
  const past1 = new Date()
  past1.setUTCDate(past1.getUTCDate() - 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  await page.getByLabel('Start date').fill(iso(past30))
  await page.getByLabel('End date').fill(iso(past1))
  await page.getByRole('button', { name: 'Save dates' }).click()
  await expect(page.getByTestId('platform-overview')).toContainText('Expired')

  // Alice (owner) sees the informational banner — ordering NOT blocked.
  await signInAs(page, seedCredentials.alice)
  const banner = page.getByTestId('subscription-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('data-banner-state', 'expired')
})

test('disablement blocks the customer entry and shows the tenant notice (FR-005/FR-006)', async ({
  page,
  browser,
}) => {
  // The super admin disables Blue Olive with a reason.
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  await page.getByRole('button', { name: 'Disable' }).first().click()
  await page
    .getByPlaceholder(/why is this restaurant being disabled/i)
    .fill('E2E: platform suspension')
  await page.getByRole('button', { name: 'Confirm disable' }).click()
  await expect(page.getByTestId('platform-overview')).toContainText('Disabled')
  await expect(page.getByTestId('platform-overview')).toContainText('E2E: platform suspension')

  // The customer entry flow refuses at the branch step (the public surface).
  const customer = await browser.newPage()
  await customer.goto(`/r/${SLUG}`)
  await customer.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await customer.getByLabel('Table').selectOption({ label: 'T3' })
  await customer.getByLabel('Your name').fill('Blocked Customer')
  await customer.getByLabel('Phone number').fill('+15550777')
  await customer.getByRole('button', { name: 'Join the table' }).click()
  await expect(customer.getByText(/not available/i)).toBeVisible()
  await customer.close()

  // Alice sees the disabled banner.
  await signInAs(page, seedCredentials.alice)
  const banner = page.getByTestId('subscription-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toHaveAttribute('data-banner-state', 'disabled')
  await expect(banner).toContainText('E2E: platform suspension')
})

test('re-enable restores the tenant state (FR-005)', async ({ page }) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  await page.getByRole('button', { name: 'Re-enable' }).first().click()
  await expect(page.getByTestId('platform-overview')).toContainText('Expired')
})

test('non-super-admin identities cannot reach the console (FR-009)', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/admin/platform')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})
