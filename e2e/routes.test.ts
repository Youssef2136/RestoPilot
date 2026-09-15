import { expect, test } from '@playwright/test'

const baselineRoutes = [
  { path: '/', heading: 'RestoPilot' },
  { path: '/r/demo-restaurant', heading: 'Restaurant' },
  { path: '/order/demo-branch', heading: 'Order' },
  { path: '/dashboard', heading: 'Staff Dashboard' },
  { path: '/admin', heading: 'Super Admin' },
]

for (const { path, heading } of baselineRoutes) {
  test(`route ${path} renders its distinct placeholder area`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
}
