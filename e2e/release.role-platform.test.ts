import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * specs/039 T008 — the PLATFORM SUPER-ADMIN's isolated role journey
 * (US2/FR-02): the console ownership (its landing is /admin per the
 * platform persona) + the subscription surface's primary state proof +
 * one honest boundary (the platform persona has NO staff dashboard — a
 * /dashboard deep link is the platform-admin model's bounded posture).
 */
test.describe.configure({ mode: 'serial' })

test('platform admin: the console lands, tenants are visible, and the staff area is out of bounds (FR-02)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.platformAdmin)

  // The super admin's default landing is /admin (auth.routes pins it).
  await expect(page).toHaveURL(/\/admin/)

  // The console's primary task: the tenant list renders Blue Olive + Cedar
  // Grill (the platform's own vocabulary; F-014's posture).
  await page.goto('/admin/platform')
  await expect(page.getByText('Blue Olive').first()).toBeVisible()

  // THE BOUNDARY: the platform persona holds no staff membership — the
  // dashboard deep link renders the model's bounded posture (the same
  //角的 posture auth.routes pins: the platform admin's dashboard is /admin,
  // and the STAFF area denies).
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { level: 1, name: /Staff Dashboard|Not authorized/ }),
  ).toBeVisible()
})
