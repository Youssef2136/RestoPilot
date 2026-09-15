import { expect, test } from '@playwright/test'

test('application root renders the RestoPilot shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'RestoPilot' })).toBeVisible()
  await expect(page.getByRole('navigation')).toBeVisible()
})
