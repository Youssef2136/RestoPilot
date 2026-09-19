import { expect, test, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Menu surfaces E2E matrix (spec 005 US1: FR-001, FR-003, FR-009, SC-002;
 * US2 additions land with that story's surface) — READ-AND-REJECT ONLY: this
 * suite creates, edits, and deletes no menu data. The write journeys are
 * proven by the database suite (`tests/database/menu.rpc.test.ts`) and the
 * Storage round trip (`tests/integration/menu.images.test.ts`), plus
 * quickstart Walkthrough A; this file walks the browser presentation matrix
 * those tiers cannot prove: the owner's menu surface rendering the seeded
 * shared menu in its stored order, and the non-owner deep links that must be
 * REJECTED (NotAuthorized), not hidden.
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

test('the owner reaches /dashboard/menu from the staff navigation and sees the seeded menu (FR-009, SC-007)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page
    .getByRole('navigation', { name: 'Staff area' })
    .getByRole('link', { name: 'Menu' })
    .click()
  await expect(page).toHaveURL(/\/dashboard\/menu$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  await expect(page.getByText('The shared menu of Blue Olive.', { exact: false })).toBeVisible()

  // The seeded categories render in their stored order.
  const categoryHeadings = page.getByRole('heading', { level: 3 })
  await expect(categoryHeadings.first()).toHaveText('Starters')

  // Descriptions and two-decimal prices are visible.
  await expect(
    page.getByText('Chickpea purée with tahini, olive oil, and warm pita.'),
  ).toBeVisible()
  await expect(page.getByText('Hummus', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('6.50', { exact: false }).first()).toBeVisible()

  // The create affordances are present for the owner (presentation only —
  // the RPCs remain the boundary).
  await expect(page.getByRole('heading', { level: 3, name: 'Add a category' })).toBeVisible()
})

test('a cashier is rejected at /dashboard/menu (FR-003; rejected, not hidden)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Add a category' })).toHaveCount(0)
})

test('a kitchen member is rejected at /dashboard/menu', async ({ page }) => {
  await signInAs(page, seedCredentials.dan)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

test('another restaurant’s owner sees only their own menu', async ({ page }) => {
  await signInAs(page, seedCredentials.eve)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/menu')
  // Eve owns Cedar Grill: the page renders HER menu, and Blue Olive's
  // categories are unreachable (the policies narrow the reads).
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Grill' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Starters' })).toHaveCount(0)
  await expect(page.getByText('Hummus', { exact: false })).toHaveCount(0)
})

test('the platform admin is rejected at /dashboard/menu', async ({ page }) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// US2 — the branch view: what customers see, and who may change it
// ─────────────────────────────────────────────────────────────────────────────

test('the branch view hides unoffered items in the customer view and explains them for staff (FR-012, FR-013)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.marina}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Marina menu' })).toBeVisible()

  // Scope every assertion to the preview's own category region: the
  // availability controls below repeat the item names, and the reasons are
  // what distinguish the preview's rendering.
  const mains = page.getByRole('region', { name: 'Mains' })

  // Staff view: the unoffered items are visible WITH the reason they are
  // missing — the restaurant-wide stop, and this branch's own override.
  await expect(mains.getByText('Grilled Sea Bass')).toBeVisible()
  await expect(mains.getByText('(stopped restaurant-wide)')).toBeVisible()
  await expect(mains.getByText('(unavailable at this branch)')).toBeVisible()

  // Customer view: exactly the offered subset remains.
  await page.getByLabel('Customer view (hide what customers will not see)').check()
  await expect(mains.getByText('Grilled Sea Bass')).toHaveCount(0)
  await expect(mains.getByText('Chicken Tagine')).toHaveCount(0)
  await expect(mains.getByText('Lamb Kebab')).toBeVisible()
})

test('an item overridden at one branch is still offered at another (FR-013)', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown menu' })).toBeVisible()

  const mains = page.getByRole('region', { name: 'Mains' })

  // The branch override does not apply here…
  await expect(mains.getByText('Chicken Tagine')).toBeVisible()
  await expect(mains.getByText('(unavailable at this branch)')).toHaveCount(0)
  // …while the restaurant-wide stop still does.
  await expect(mains.getByText('(stopped restaurant-wide)')).toBeVisible()
})

test('a branch manager gets the availability controls for their own branch only (FR-003, FR-014)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto(`/dashboard/branches/${branchIds.downtown}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown menu' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Branch availability' })).toBeVisible()
  // The restaurant-wide controls are the owner's.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Restaurant-wide availability' }),
  ).toHaveCount(0)

  // Another branch of the same restaurant: rejected, not merely empty.
  await page.goto(`/dashboard/branches/${branchIds.marina}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()

  // Menu management stays owner-only.
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// US4 — item-scoped extras: each item shows ONLY its own extras (read-only;
// the write journeys are proven at the database and unit tiers, T035/T034)
// ─────────────────────────────────────────────────────────────────────────────

test('the seeded extras appear on their own item in the owner editor and the branch view (FR-018, SC-007)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await expect(page).toHaveURL(/\/dashboard$/)

  // Owner editor: Lamb Kebab's three seeded extras render in stored order.
  await page.goto('/dashboard/menu')
  const mainsRegion = page.getByRole('region', { name: 'Mains' })
  await expect(mainsRegion.getByText('Extra garlic sauce — Free')).toBeVisible()
  await expect(mainsRegion.getByText('Extra rice — +3.00')).toBeVisible()
  await expect(mainsRegion.getByText('Extra chili — +0.50')).toBeVisible()

  // Hummus (Starters) shows no extras at all — the other item shows only its
  // own (the composite FK makes the isolation real; T035 proves it there).
  const startersRegion = page.getByRole('region', { name: 'Starters' })
  await expect(startersRegion.getByText('Extra garlic sauce')).toHaveCount(0)
  await expect(startersRegion.getByText('Extra rice')).toHaveCount(0)

  // The editor's per-item extras section: Hummus's editor lists no extras.
  await startersRegion.getByRole('button', { name: 'Edit Hummus' }).click()
  const hummusExtras = page.getByRole('region', { name: 'Extras for Hummus' })
  await expect(hummusExtras.getByText('No extras yet.')).toBeVisible()
  await expect(hummusExtras.getByText('Extra garlic sauce')).toHaveCount(0)

  // Branch view (Downtown): the same item-scoped presentation, read-only.
  await page.goto(`/dashboard/branches/${branchIds.downtown}/menu`)
  const branchMains = page.getByRole('region', { name: 'Mains' })
  await expect(branchMains.getByText('Extra garlic sauce — Free')).toBeVisible()
  await expect(branchMains.getByText('Extra rice — +3.00')).toBeVisible()
  await expect(branchMains.getByText('Extra chili — +0.50')).toBeVisible()
  // The starters items carry no extras (item scoping in the projection).
  const branchStarters = page.getByRole('region', { name: 'Starters' })
  await expect(branchStarters.getByText('Extra rice')).toHaveCount(0)
})

test("another restaurant's menu never shows Blue Olive's extras (FR-018, FR-024)", async ({
  page,
}) => {
  await signInAs(page, seedCredentials.eve)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/dashboard/branches/${branchIds.airport}/menu`)
  const grill = page.getByRole('region', { name: 'Grill' })
  await expect(grill.getByText('Extra garlic sauce')).toHaveCount(0)
  await expect(grill.getByText('Extra rice')).toHaveCount(0)
})
