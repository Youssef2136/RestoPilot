import { expect, test } from '@playwright/test'

/**
 * Phase 03 smoke migration: `/` now renders through CustomerShell (spec 023
 * FR-01) — the customer surface is its own navigation, so the shell carries
 * NO nav landmark (the old AppShell's global navigation is gone by design;
 * the E2E contract moves to "main renders, no staff nav leaks").
 */
test('application root renders the customer surface with its main landmark', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})
