import { expect, test } from '@playwright/test'

/**
 * The live error-boundary proof (spec 021 US1 acceptance, SC-002): a render
 * error thrown in the dev-only gallery is caught by the top-level
 * ErrorBoundary — the recoverable view replaces the page, no white screen,
 * no internal message, and the boundary's one console log is the explicitly
 * expected entry (F-G14 list in helpers/console.ts).
 *
 * DEV-only: the gallery route does not exist in production builds (FR-09);
 * this spec skips outside dev (Playwright always runs against the dev
 * server, so the skip is defensive).
 */
test.skip(process.env.NODE_ENV === 'production', 'gallery is DEV-only')

test('a render error renders the recoverable view — never a white screen', async ({ page }) => {
  await page.goto('/dev/gallery')
  await page.getByRole('button', { name: 'Trigger a render error (dev proof)' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible()
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain('Intentional dev-gallery render error')
  await expect(page.getByRole('link', { name: 'Go to dashboard' })).toBeVisible()
})

test('the recovery links navigate to working routes after a caught error', async ({ page }) => {
  await page.goto('/dev/gallery')
  await page.getByRole('button', { name: 'Trigger a render error (dev proof)' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible()

  await page.getByRole('link', { name: 'Go to sign-in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()
})
