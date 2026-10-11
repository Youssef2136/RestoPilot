import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * specs/039 T004 — the OWNER's isolated role journey (US2/FR-02): alice
 * proves her primary task (restaurant ownership surfaces: menu structure,
 * tax configuration, branches) and one honest denial (a super-admin-only
 * deep link renders the explicit denial — out of HER reach; the platform
 * console is the boundary).
 */
test.describe.configure({ mode: 'serial' })

test('owner: the management surfaces answer; a super-admin deep link is denied honestly (FR-02)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)

  // Primary task: menu structure (management surface renders HER menu).
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  await expect(page.locator('main').getByText('Starters', { exact: true }).first()).toBeVisible()

  // Tax configuration (the owner-only surface renders the rules).
  await page.goto('/dashboard/tax')
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()
  await expect(page.locator('main').getByText('VAT').first()).toBeVisible()

  // Branches with their policy-scoped reads (owner sees EVERY branch).
  await page.goto('/dashboard/branches')
  await expect(page.locator('main').getByText('Downtown').first()).toBeVisible()

  // THE DENIAL: the platform console is super-admin-only for alice.
  await page.goto('/admin/platform')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})
