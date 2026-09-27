import { expect } from '@playwright/test'
import { test } from '@playwright/test'

/**
 * The viewport smoke (spec 021 FR-08 / US4, SC-003): the existing surfaces
 * render at the mobile (390×844) and tablet (834×1112) viewports without
 * horizontal overflow. This spec is assigned to the two tagged viewport
 * projects in playwright.config.ts (testMatch scope); the desktop project
 * does not run it. No responsive CSS exists yet — this pins the current
 * posture so later phases cannot silently regress it.
 */

const smokeRoutes = ['/', '/r/demo-restaurant', '/signin', '/reset-password', '/account/password']

for (const route of smokeRoutes) {
  test(`viewport smoke: ${route} renders without horizontal overflow`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      // 1px tolerance for scrollbar rounding.
      return doc.scrollWidth - doc.clientWidth
    })
    expect(
      overflow,
      `${route} overflows horizontally at ${page.viewportSize()?.width}px`,
    ).toBeLessThanOrEqual(1)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}
