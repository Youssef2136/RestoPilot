import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'
import { withSubscriptionLock } from './helpers/subscriptionLock'

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

// The disable→re-enable pair flips the platform kill-switch on Blue Olive.
// The poisoned span must cover EVERYTHING between those tests (serial or
// not, another file's customer entry could land in the gap and hit "This
// restaurant is not available."). The lock is held ONLY across those two
// tests — NOT the whole file: a file-spanning hold queued every other
// spec's customer entry behind the entire platform run (~4 min with
// onboarding) and blew the realtime suite's 30s default test timeout.
// The afterAll guard below re-enables the kill switch even if the disable
// test dies mid-window (serial mode would otherwise skip the re-enable
// test and wedge the tenant).
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
  await withSubscriptionLock(async () => {
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
})

test("an expired subscription shows the tenant banner but doesn't block (FR-007, FR-010)", async ({
  page,
}) => {
  await withSubscriptionLock(async () => {
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
})

test('disablement blocks the customer entry and shows the tenant notice (FR-005/FR-006)', async ({
  page,
  browser,
}) => {
  // Kill-switch window part 1 — queueing budget for the shared entry lock
  // plus the walk (30s default is not enough under parallel contention).
  test.setTimeout(120_000)
  await withEntryLock(async () => {
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
  }) // withEntryLock — the kill-switch window stays open for re-enable.
})

test('re-enable restores the tenant state (FR-005)', async ({ page }) => {
  // Kill-switch window part 2 — Blue Olive stays kill-switched until this
  // lands (see the disable test for the lock rationale + budget).
  test.setTimeout(120_000)
  await withEntryLock(async () => {
    await signInAs(page, seedCredentials.platformAdmin)
    await page.goto('/admin/platform')
    await page.getByRole('button', { name: 'Re-enable' }).first().click()
    await expect(page.getByTestId('platform-overview')).toContainText('Expired')
  })
})

test.afterAll(async ({ browser }) => {
  // Kill-switch safety net: if any test above died inside the poisoned
  // window (serial mode skips the re-enable test after a failure), restore
  // the tenant so the rest of the suite is not poisoned. A no-op when the
  // re-enable already ran — no Re-enable button to press.
  const admin = await browser.newPage()
  await signInAs(admin, seedCredentials.platformAdmin)
  await admin.goto('/admin/platform')
  const reEnable = admin.getByRole('button', { name: 'Re-enable' })
  if (await reEnable.isVisible().catch(() => false)) {
    await reEnable.click()
    await expect(admin.getByTestId('platform-overview')).toContainText('Expired')
  }
  await admin.close()
})

test('non-super-admin identities cannot reach the console (FR-009)', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/admin/platform')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

test('the super admin onboards a restaurant and its first owner through the console (spec 019, FR-001–FR-007, FR-009)', async ({
  page,
}) => {
  const slug = `onboarded-e2e-${Date.now()}`
  // A FRESH owner email per run: the onboarding RPC links an auth identity
  // that already exists ("no credential issued") instead of minting the
  // one-time credential — a rerun against yesterday's owner would deadlock
  // the credential assertions. Unique per run keeps the happy path on the
  // credential branch (the linked-identity branch is proven elsewhere).
  const ownerEmail = `e2e-harbor-owner-${Date.now()}@restopilot.dev`
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')

  // Refusal first: an in-use identifier → the server's message verbatim and
  // the form preserved (the super admin can correct it).
  await page.getByLabel('Restaurant name').fill('E2E Harbor Cafe')
  await page.getByLabel('Public identifier').fill('blue-olive')
  await page.getByLabel('First owner email').fill(ownerEmail)
  await page.getByLabel('First owner display name').fill('Harbor Owner')
  await page.getByRole('button', { name: 'Onboard restaurant' }).click()
  await expect(
    page.getByText('This public identifier is already in use by another restaurant.'),
  ).toBeVisible()
  await expect(page.getByLabel('Restaurant name')).toHaveValue('E2E Harbor Cafe')

  // The happy path: a unique identifier → success status + the one-time
  // credential (24 hex chars, shown once, with the copy affordance + note).
  await page.getByLabel('Public identifier').fill(slug)
  await page.getByRole('button', { name: 'Onboard restaurant' }).click()
  await expect(
    page.getByText(
      'Onboarded "E2E Harbor Cafe" — a one-time credential was issued to the first owner.',
    ),
  ).toBeVisible()
  const credential = page.getByRole('code')
  await expect(credential).toHaveText(/^[0-9a-f]{24}$/)
  await expect(page.getByRole('button', { name: 'Copy credential' })).toBeVisible()
  await expect(page.getByText(/shown only once/i)).toBeVisible()

  // Console coherence (FR-009): the overview shows the new tenant immediately
  // with the derived never-activated state.
  const table = page.getByTestId('platform-overview')
  await expect(table).toContainText('E2E Harbor Cafe')
  await expect(table).toContainText('Never activated')

  // Credential discipline (FR-003): the NEXT action — here a refused
  // onboarding — clears the credential block; the secret is never
  // re-displayed afterwards.
  await page.getByLabel('Restaurant name').fill('E2E Harbor Cafe')
  await page.getByLabel('Public identifier').fill('blue-olive')
  await page.getByRole('button', { name: 'Onboard restaurant' }).click()
  await expect(
    page.getByText('This public identifier is already in use by another restaurant.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy credential' })).toHaveCount(0)
})
