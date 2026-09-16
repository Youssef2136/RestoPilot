import { expect, test, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Management surfaces E2E matrix (spec 004 US1/US2; FR-001, FR-004, FR-005,
 * FR-006, FR-007, FR-008, FR-009, FR-017, FR-021; research.md §16) —
 * READ-AND-REJECT ONLY: this suite creates no tenant, branch, table, or staff
 * data. Creation journeys are proven by the database and integration suites
 * plus quickstart Walkthrough A; this file walks the browser presentation
 * matrix the unit and data suites cannot prove: the FR-001 creation panel for
 * the membership-less linked profile, the owner's management navigation and
 * page, the FR-004 warning-before-confirm flow (cancelled, never submitted),
 * and the non-owner/super-admin denials that must render NotAuthorized —
 * rejected, not hidden.
 *
 * US2 (branch surfaces) adds: a branch-scoped member's policy-scoped branch
 * read with no management affordances, a working-hours save the server
 * provably rejects (its message surfaced verbatim; the stored schedule
 * untouched — only a zero-length payload is ever submitted), and the
 * non-owner branch deep-link denials.
 *
 * Seeded credentials come from tests/database/helpers/fixtures.ts — the same
 * source the seed applies. Playwright gives every test a fresh browser
 * context, so each test starts unauthenticated; the sign-ins per run stay
 * under the Auth API rate limit (30 per 5 minutes per IP; docs/development.md).
 */

/** Signs a seeded identity in through the /signin form. */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test("Fiona's /dashboard renders the creation panel and no other tenant's data (FR-001)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.fiona)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()

  // The FR-001 bootstrap: a linked profile without memberships gets the
  // creation panel.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Create your restaurant' }),
  ).toBeVisible()
  await expect(page.getByText('Your account is not yet part of a restaurant.')).toBeVisible()

  // No other tenant's data, no staff-area membership surfaces.
  await expect(page.getByText('Blue Olive')).toHaveCount(0)
  await expect(page.getByText('Cedar Grill')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Staff area' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Staff list' })).toHaveCount(0)
})

test('the owner (Alice) reaches the management navigation and /dashboard/restaurant (FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page
    .getByRole('navigation', { name: 'Staff area' })
    .getByRole('link', { name: 'Restaurant' })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/restaurant$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Restaurant' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Profile' })).toBeVisible()

  // The seeded profile and settings are readable and ready to edit.
  await expect(page.getByLabel('Display name')).toHaveValue('Blue Olive')
  await expect(page.getByLabel('Public identifier')).toHaveValue('blue-olive')
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Timezone')).toHaveValue('Europe/Lisbon')
})

test('the FR-004 warning appears before an identifier change is confirmed, and cancelling leaves it unchanged', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  // Let the sign-in round trip complete before the direct navigation.
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/restaurant')

  const identifier = page.getByLabel('Public identifier')
  await expect(identifier).toHaveValue('blue-olive')

  // Submitting a changed identifier does NOT save it — the consequence
  // warning appears first.
  await identifier.fill('blue-olive-change-attempt')
  await page.getByRole('button', { name: 'Save profile' }).click()

  const warning = page.getByRole('alert')
  await expect(warning).toContainText('will no longer address this restaurant')
  await expect(warning).toContainText('no alias, no redirect, no history')
  await expect(page.getByRole('button', { name: 'Confirm identifier change' })).toBeVisible()

  // Cancelling discards the submitted value; nothing was submitted.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: 'Confirm identifier change' })).toHaveCount(0)
  await expect(identifier).toHaveValue('blue-olive')

  // The stored identifier is untouched — a full reload re-reads it.
  await page.reload()
  await expect(page.getByLabel('Public identifier')).toHaveValue('blue-olive')
})

test('a branch manager (Bob) sees no management affordance and is rejected on the management deep link (FR-006/FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)

  // No owner management entry in the navigation — presentation only.
  await expect(
    page.getByRole('navigation', { name: 'Staff area' }).getByRole('link', { name: 'Restaurant' }),
  ).toHaveCount(0)

  // The deep link is rejected in place — not redirected, not hidden.
  await page.goto('/dashboard/restaurant')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/restaurant$/)
})

test('a cashier (Carla) is rejected on the management deep link (FR-006/FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/dashboard/restaurant')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/restaurant$/)
})

test('the platform super admin is rejected on the management deep links — the capability grants no tenant access (FR-021)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)

  // Tenant management surfaces: denied. The capability is the only key it
  // carries, and it unlocks no restaurant.
  await page.goto('/dashboard/restaurant')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/restaurant$/)

  await page.goto('/dashboard/staff')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/staff$/)

  // /dashboard itself is NOT a management surface: it admits any linked
  // profile (research.md §13), rendering the creation panel for this
  // membership-less profile — creation is the person-level entitlement
  // (FR-001), not a tenant-access grant.
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Create your restaurant' }),
  ).toBeVisible()
})

test("Bob (branch manager, Downtown) reads his own branch's working hours and no management affordances (FR-008/FR-017)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)

  // The branch list is policy-scoped: his assigned branch only, and the
  // owner-only create/rename affordances are absent.
  await page.goto('/dashboard/branches')
  await expect(page.getByRole('heading', { level: 1, name: 'Branches' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Downtown' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Marina' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Create a branch' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rename Downtown' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Downtown' }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/branches/${branchIds.downtown}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()

  // The seeded schedule reads back: the split day, the post-midnight notation,
  // and the closed day.
  await expect(page.getByRole('listitem').filter({ hasText: 'Monday:' })).toContainText(
    '11:00–15:00, 18:00–02:00 (next day)',
  )
  await expect(page.getByText('Sunday: Closed')).toBeVisible()

  // No management affordance: the working-hours editor is owner-only.
  await expect(page.getByRole('heading', { name: 'Edit working hours' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save working hours' })).toHaveCount(0)

  // A branch outside his scope is rejected in place, without echoing the
  // requested branch's identity.
  await page.goto(`/dashboard/branches/${branchIds.marina}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/dashboard/branches/${branchIds.marina}$`))
  await expect(page.getByText('Marina')).toHaveCount(0)
})

test('a working-hours save the server rejects surfaces the clear message and leaves the stored schedule unchanged (FR-008)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}`)

  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Edit working hours' })).toBeVisible()

  // A zero-length Monday interval — the server's rejection, verbatim. The
  // suite only ever submits a payload the server provably rejects, so no
  // stored schedule is ever changed.
  const mondayClose = page.getByLabel('Monday interval 1 closing time')
  await expect(mondayClose).toHaveValue('15:00')
  await mondayClose.fill('11:00')
  await page.getByRole('button', { name: 'Save working hours' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'An interval cannot start and end at the same time.',
  )

  // The stored schedule is unchanged: a full reload re-reads the seed
  // (the replacement is all-or-nothing).
  await page.reload()
  await expect(page.getByLabel('Monday interval 1 closing time')).toHaveValue('15:00')
  await expect(page.getByRole('listitem').filter({ hasText: 'Monday:' })).toContainText(
    '11:00–15:00, 18:00–02:00 (next day)',
  )
})

test('a cashier (Carla) is rejected on an out-of-scope branch deep link (FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto(`/dashboard/branches/${branchIds.airport}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/dashboard/branches/${branchIds.airport}$`))
  await expect(page.getByText('Airport')).toHaveCount(0)
})

test('the platform super admin is rejected on the branch management deep links (FR-021)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/dashboard/branches')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard\/branches$/)

  await page.goto(`/dashboard/branches/${branchIds.downtown}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/dashboard/branches/${branchIds.downtown}$`))
})

test('the owner sees the branch tables including the seeded inactive table with its state, plus the manage affordances (FR-011/FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)

  // Marina carries the seeded inactive table: it stays listed WITH its state
  // (there is no delete path — only the activation state ever changes).
  await page.goto(`/dashboard/branches/${branchIds.marina}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Marina' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tables' })).toBeVisible()

  const marinaTable = page.getByRole('listitem').filter({ hasText: 'T1' })
  await expect(marinaTable).toContainText('Inactive')
  await expect(page.getByRole('button', { name: 'Reactivate T1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deactivate T1' })).toHaveCount(0)

  // The owner-only controls: inline rename and the create form.
  await expect(page.getByRole('button', { name: 'Rename T1' })).toBeVisible()
  await expect(page.getByLabel('Table label')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create table' })).toBeVisible()

  // Downtown's seeded tables are all active — the state is per table, not a
  // property of the branch.
  await page.goto(`/dashboard/branches/${branchIds.downtown}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()
  for (const label of ['T1', 'T2', 'T3']) {
    await expect(page.getByRole('listitem').filter({ hasText: label })).toContainText('Active')
  }
})

test('a non-owner sees the branch tables the policy grants and no manage affordances (FR-011/FR-017)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto(`/dashboard/branches/${branchIds.downtown}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tables' })).toBeVisible()

  // The policy-scoped list is readable — with no owner control anywhere on it.
  await expect(page.getByRole('listitem').filter({ hasText: 'T1' })).toContainText('Active')
  await expect(page.getByRole('button', { name: 'Rename T1' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Deactivate T1' })).toHaveCount(0)
  await expect(page.getByLabel('Table label')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create table' })).toHaveCount(0)
})

test('the owner obtains the QR entry point: the panel renders with its payload visible and the seeded identifier (FR-018/FR-019)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/restaurant')

  await expect(page.getByRole('heading', { name: 'Customer entry QR' })).toBeVisible()

  // The payload is shown as text next to the code, so the target is verifiable
  // without decoding: the seeded public identifier, and nothing else.
  const payload = page.getByTestId('qr-entry-url')
  await expect(payload).toBeVisible()
  await expect(payload).toContainText('/r/blue-olive')
  await expect(payload).not.toContainText('?')
  await expect(payload).not.toContainText('#')

  // The code itself is generated and both artifact formats are downloadable.
  await expect(page.getByTestId('qr-code').locator('svg')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})

test('the QR panel is absent for non-owners and the super admin — the restaurant row is not readable to them (FR-018/FR-019)', async ({
  page,
}) => {
  // A branch manager of the same restaurant: management is owner-only.
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/restaurant')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Customer entry QR' })).toHaveCount(0)
  await expect(page.getByTestId('qr-entry-url')).toHaveCount(0)

  // The platform super admin: the capability grants no tenant access (FR-021).
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/dashboard/restaurant')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Customer entry QR' })).toHaveCount(0)
})
