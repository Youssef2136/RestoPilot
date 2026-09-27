import { test } from '@playwright/test'
import { expectNoNewViolations } from './helpers/a11y'

/**
 * The axe baseline (spec 021 FR-07 / US4, SC-003): WCAG 2.2 AA automatable
 * floor on the signed-out routes. Findings not in the committed baseline
 * (helpers/a11y.ts) fail the run; baseline entries require a written
 * justification and an owning phase.
 */
const scannedRoutes = ['/', '/signin', '/reset-password', '/dashboard']

for (const route of scannedRoutes) {
  test(`axe baseline: ${route} introduces no new violations (WCAG 2.2 AA)`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    // /dashboard redirects to /signin signed-out — the scan still covers the
    // rendered document (the sign-in view), which is the signed-out staff
    // posture the phase's baseline records.
    await expectNoNewViolations(page, { route })
  })
}
