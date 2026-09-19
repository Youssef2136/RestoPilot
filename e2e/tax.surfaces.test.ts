import { expect, test, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Tax surfaces E2E matrix (spec 006 US1: FR-001, FR-003, FR-008, SC-002;
 * contracts/tax-client.md §2) — READ-AND-REJECT ONLY: this suite creates,
 * edits, and deletes no tax data. The write journeys are proven by the
 * database suite (`tests/database/tax.rpc.test.ts`) and the unit suite
 * (`tests/unit/tax.client.test.ts`), plus quickstart Walkthrough A; this file
 * walks the browser presentation matrix those tiers cannot prove: the owner's
 * tax surface rendering the seeded configuration in its stored order with
 * scope badges and rates, the owner's "Tax" navigation entry, and the
 * non-owner deep links that must be REJECTED (NotAuthorized), not hidden.
 *
 * Seeded credentials come from tests/database/helpers/fixtures.ts — the same
 * source the seed applies. Playwright gives every test a fresh browser
 * context, so each test starts unauthenticated.
 */

/** Signs a seeded identity in through the /signin form. */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('the owner reaches /dashboard/tax from the staff navigation and sees the seeded rules in order (FR-001, FR-008, SC-007)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page
    .getByRole('navigation', { name: 'Staff area' })
    .getByRole('link', { name: 'Tax' })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/tax$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()

  // The seeded rules render in their stored (sort_order, name) order with
  // scope badges, rates, and the compound-source label.
  const listItems = page.getByRole('list').filter({ has: page.getByText('VAT') })
  await expect(listItems.getByText('VAT — 8.25%', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('City tax — 1.5%', { exact: false })).toBeVisible()
  await expect(page.getByText('(Total)', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('compounds on VAT')).toBeVisible()

  // The create affordance is present for the owner (presentation only —
  // the RPCs remain the boundary).
  await expect(page.getByRole('button', { name: 'Add a tax rule' })).toBeVisible()
})

test('a branch manager is rejected at /dashboard/tax (FR-003; rejected, not hidden)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add a tax rule' })).toHaveCount(0)
})

test('a cashier is rejected at /dashboard/tax', async ({ page }) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

test('a kitchen member is rejected at /dashboard/tax', async ({ page }) => {
  await signInAs(page, seedCredentials.dan)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

test("another restaurant's owner is rejected at Blue Olive's /dashboard/tax (FR-003)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.eve)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/tax')
  // Eve owns Cedar Grill: the page renders HER tax configuration, and Blue
  // Olive's rules are unreachable (the policies narrow the reads) — the same
  // posture as the menu page (rejected, not hidden, by the data layer).
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()
  await expect(page.getByText('IGIC — 7%', { exact: false })).toBeVisible()
  await expect(page.getByText('VAT — 8.25%', { exact: false })).toHaveCount(0)
  await expect(page.getByText('City tax')).toHaveCount(0)
})

test('the platform admin is rejected at /dashboard/tax', async ({ page }) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// US2 — the branch view: effective configurations with origins, controls
// within scope, and rejection outside it (read-only; the write journeys are
// proven at the database tier, T023)
// ─────────────────────────────────────────────────────────────────────────────

test("alice sees Marina's effective configuration with the override origin at 8.75% (FR-009, FR-020)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.marina}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Marina tax' })).toBeVisible()
  await expect(page.getByText('VAT — 8.75% (branch override)', { exact: false })).toBeVisible()
  await expect(page.getByText('City tax — 1.5%', { exact: false })).toBeVisible()
  // No Downtown surcharge at Marina.
  await expect(page.getByText('Downtown surcharge')).toHaveCount(0)
})

test("alice sees Downtown's configuration with the branch-only surcharge (FR-020)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  await expect(
    page.getByText('Downtown surcharge — 2% (branch-only)', { exact: false }),
  ).toBeVisible()
  // Downtown has no override: VAT at the restaurant default.
  await expect(page.getByText('VAT — 8.25%', { exact: false })).toBeVisible()
  await expect(page.getByText('(branch override)')).toHaveCount(0)
})

test("bob sees Downtown's controls and is rejected at Marina's branch tax view (FR-003)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)

  // His own branch: the view WITH the override controls.
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  // The override controls carry per-rule accessible names ("Override VAT at
  // this branch"); matching the shared prefix proves the controls exist.
  await expect(page.getByRole('button', { name: 'Override', exact: false }).first()).toBeVisible()

  // Another branch of the same restaurant: rejected, not merely empty.
  await page.goto(`/dashboard/branches/${branchIds.marina}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()

  // Restaurant-wide tax management stays owner-only.
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

test("carla sees Downtown's tax view with no controls (FR-020)", async ({ page }) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  await expect(page.getByText('VAT — 8.25%', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Override', exact: false })).toHaveCount(0)
})

test("eve (another restaurant's owner) is rejected at Blue Olive's branch tax view (FR-003)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.eve)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  // Eve holds a cashier membership AT Downtown — but the branch tax VIEW is
  // scoped to staff of the branch's restaurant, which she is (as a cashier).
  // The VIEW therefore renders read-only for her; the CONTROLS stay denied by
  // the override RPC (proven at the database tier, T009/T023).
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Override', exact: false })).toHaveCount(0)
})

test("alice's Downtown branch tax view renders the calculation preview lines in the configured order (FR-014, SC-004)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()

  // Build a basket of one Hummus (6.50) and submit it once.
  await page.getByLabel('Add an item').selectOption({ label: 'Hummus — 6.50' })
  await page.getByRole('button', { name: 'Calculate taxes' }).click()

  // The result renders the engine's lines — name, rate, scope, amount — in
  // the configured order, plus subtotal and total. Downtown's seed: VAT
  // 8.25% over 6.50 = 0.54 (rounded once, half-up, server-side); City tax
  // compounds on the rounded amount (6.50 + 0.54) × 1.5% = 0.11; the
  // branch-only surcharge closes the list at 0.13. Total 7.28.
  await expect(page.getByText('What the customer will be shown')).toBeVisible()
  const rows = page.getByRole('row')
  await expect(rows.filter({ hasText: 'VAT' }).first()).toContainText('0.54')
  await expect(rows.filter({ hasText: 'City tax' }).first()).toContainText('0.11')
  await expect(rows.filter({ hasText: 'Downtown surcharge' }).first()).toContainText('0.13')
  await expect(page.getByText('Subtotal: 6.50')).toBeVisible()
  await expect(page.getByText(/Total:/)).toContainText('7.28')

  // Read-only surface: the preview offers no way to mutate configuration.
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
})

test('the calculation preview is deterministic — an identical submission renders identical lines (FR-014, FR-022)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()

  await page.getByLabel('Add an item').selectOption({ label: 'Hummus — 6.50' })
  await page.getByRole('button', { name: 'Calculate taxes' }).click()
  await expect(page.getByText('What the customer will be shown')).toBeVisible()
  await expect(page.getByText('Subtotal: 6.50')).toBeVisible()

  // Repeat the identical submission; the rendered lines are identical.
  await page.getByRole('button', { name: 'Calculate taxes' }).click()
  await expect(page.getByText('Subtotal: 6.50')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'VAT' }).first()).toContainText('0.54')
})

test("a staff member with no offered items at their branch sees the preview's empty state (FR-012)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.dan)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.marina}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Marina tax' })).toBeVisible()
  // Marina serves the shared Blue Olive menu, so the picker exists; the
  // empty-basket state is shown before any submission (zero lines, no error).
  await expect(page.getByText('The basket is empty')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Calculate taxes' })).toBeDisabled()
})
