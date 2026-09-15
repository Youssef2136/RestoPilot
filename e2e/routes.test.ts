import { expect, test } from '@playwright/test'

/**
 * Baseline route surface (Phase 0 placeholders + the US3 guard wiring).
 * Public routes render their distinct areas; protected routes redirect an
 * unauthenticated visitor to /signin (FR-013) — the full sign-in return-to
 * round-trip, per-role landings, and guard denials are covered by
 * e2e/auth.routes.test.ts.
 */
const publicRoutes = [
  { path: '/', heading: 'RestoPilot' },
  { path: '/r/demo-restaurant', heading: 'Restaurant' },
  { path: '/order/demo-branch', heading: 'Order' },
  { path: '/signin', heading: 'Staff sign-in' },
]

for (const { path, heading } of publicRoutes) {
  test(`public route ${path} renders its distinct area`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
}

for (const path of ['/dashboard', '/admin']) {
  test(`protected route ${path} redirects unauthenticated visitors to /signin (FR-013)`, async ({
    page,
  }) => {
    await page.goto(path)
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()
  })
}
