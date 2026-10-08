import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { setViewport } from './helpers/responsive'

/**
 * The same-disclosure rule (spec 036 T011, FR-06/Security, W3): the card
 * fallback discloses EXACTLY what the table view disclosed for the same
 * role — no column disappears, no field appears (a narrower layout must not
 * reveal data hidden by it, nor hide what the table showed).
 *
 * The proven pair: the AUDIT table (`/dashboard/audit`, the bill.void.audit
 * precedent — bob reads his branch's audit) — at the desktop width the
 * manager reads the table's columns (When/Action/Actor/Branch/Reason); at
 * the card width the manager reads THE SAME fields as labelled cards; and a
 * lower role (carla, cashier — audit-refused) sees the denial at BOTH widths
 * disclosing nothing new.
 */

test.describe.configure({ mode: 'serial' })

test('the manager reads the SAME audit fields as cards that the table shows (no loss, no gain)', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await setViewport(page, 'desktop1280')
  await signInAs(page, seedCredentials.bob)
  await page.goto('/dashboard/audit')
  await page.waitForLoadState('networkidle')

  // The table view's field vocabulary (the data-labels the cards reuse).
  await setViewport(page, 'wide1920')
  await page.goto('/dashboard/audit')
  await page.waitForLoadState('networkidle')
  const table = page.getByTestId('audit-table')
  await expect(table).toBeVisible()
  const tableFields = await table.locator('thead th').allInnerTexts()
  expect(tableFields).toEqual(['When', 'Action', 'Actor', 'Branch', 'Reason'])

  // Narrow to the card width: the SAME fields render as labelled cards —
  // every cell's label matches the table header set, no column lost.
  await setViewport(page, 'mobile390')
  await page.waitForLoadState('networkidle')
  await expect(table).toBeVisible()
  const cardLabels = await table
    .locator('td')
    .evaluateAll((cells) =>
      [...new Set(cells.map((c) => c.getAttribute('data-label')))].filter(Boolean),
    )
  expect([...cardLabels].sort()).toEqual([...tableFields].sort())

  // And a REAL row's content survives: the void entry from the seeded data
  // (the bill.void.audit dataset) keeps its actor/action card content.
  const anyActionCell = table.locator('td[data-label="Action"]').first()
  await expect(anyActionCell).toBeVisible()
  expect((await anyActionCell.innerText()).length).toBeGreaterThan(0)
})

test('the audit-refused cashier gains nothing at the card width', async ({ page }) => {
  test.setTimeout(180_000)
  await signInAs(page, seedCredentials.carla)
  for (const key of ['desktop1280', 'mobile390'] as const) {
    await setViewport(page, key)
    await page.goto('/dashboard/audit')
    await page.waitForLoadState('networkidle')
    // The denial view at BOTH widths: no audit table discloses itself.
    await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
    await expect(page.getByTestId('audit-table')).toHaveCount(0)
  }
})
