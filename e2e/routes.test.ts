import { expect, test } from '@playwright/test'

/**
 * Baseline route surface (the public route contract + the US3 guard wiring).
 * Public routes render their distinct areas; protected routes redirect an
 * unauthenticated visitor to /signin (FR-013) — the full sign-in return-to
 * round-trip, per-role landings, and guard denials are covered by
 * e2e/auth.routes.test.ts.
 *
 * Spec 024 migrations (F-G09/FA-8, recorded): the two C1/C2 placeholders are
 * now REAL surfaces — `/` is the public landing (h1 preserved), and
 * `/order/:branchId` REDIRECTS to `/?branch=<id>` (the old h1 'Order' pin is
 * gone with the placeholder; the redirect IS the contract).
 */
const publicRoutes = [
  { path: '/', heading: 'RestoPilot' },
  { path: '/r/demo-restaurant', heading: 'Restaurant' },
  { path: '/signin', heading: 'Staff sign-in' },
]

for (const { path, heading } of publicRoutes) {
  test(`public route ${path} renders its distinct area`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
}

test('the /order/:branchId deep link redirects to the landing with the branch echo (C1, spec 024)', async ({
  page,
}) => {
  await page.goto('/order/demo-branch')
  await expect(page).toHaveURL(/\/\?branch=demo-branch$/)
  await expect(page.getByRole('heading', { level: 1, name: 'RestoPilot' })).toBeVisible()
  // The landing acknowledges the deep link without fetching anything with it.
  await expect(page.getByRole('status')).toContainText(/QR code/)
})

test('the root landing offers the two real ways in (C2, spec 024)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'For guests' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

for (const path of ['/dashboard', '/admin']) {
  test(`protected route ${path} redirects unauthenticated visitors to /signin (FR-013)`, async ({
    page,
  }) => {
    await page.goto(path)
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()
  })
}
