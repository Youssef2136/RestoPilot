import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * specs/039 T005 — the BRANCH MANAGER's isolated role journey (US2/FR-02):
 * bob proves his primary task (Downtown oversight: the sessions board with
 * its open sessions) + the audit trail within his branch reach + one
 * denial (a cashier-order surface beyond the manager's own writing role is
 * NOT the denial here; the honest denial for a branch_manager is an
 * out-of-scope BRANCH deep link — Marina renders the denial because bob's
 * membership is Downtown-scoped).
 */
test.describe.configure({ mode: 'serial' })

test('manager: Downtown oversight + branch-scoped audit + an out-of-scope branch denial (FR-02)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)

  // Primary task: Downtown oversight reads the seeded demo sessions.
  await page.goto('/dashboard/sessions')
  await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  await expect(page.getByRole('listitem').first()).toBeVisible()

  // The audit trail renders within his Downtown reach.
  await page.goto('/dashboard/audit')
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()

  // THE DENIAL: an out-of-scope branch deep link (Dan's Marina is beyond
  // bob's Downtown membership) renders the explicit denial view.
  await page.goto('/dashboard/branches/00000000-0000-4000-8000-000000000102')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
})
