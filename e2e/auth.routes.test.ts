import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * E2E route matrix (spec FR-012/FR-013/FR-014/FR-016/FR-017, SC-004/SC-006;
 * research.md §14 — representative paths per the master plan §41 priority
 * order): unauthenticated protected routes redirect to /signin with return-to
 * and land back after a valid seeded sign-in; seeded sign-ins land on the
 * correct area per role; a deep link to an unauthorized view renders
 * NotAuthorized — rejected, not hidden; the platform super admin reaches
 * /admin. Session persistence (a page reload keeps the same identity and
 * scope) and sign-out (protected areas redirect to /signin and staff data
 * requires re-authentication) are walked here too. The full per-role matrix
 * is unit-tested in tests/unit/auth.guards.test.tsx and proven through the
 * server-side suites; this file walks the representative browser paths.
 *
 * Seeded credentials come from tests/database/helpers/fixtures.ts (FR-021) —
 * the same source the seed applies. Playwright gives every test a fresh
 * browser context, so each test starts unauthenticated. Sign-ins per run
 * (~10) stay well under the Auth API rate limit of 30 per 5 minutes
 * (research.md §12).
 */

/** Signs a seeded identity in through the /signin form. */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('unauthenticated protected routes redirect with return-to (FR-013)', () => {
  test('/dashboard redirects to /signin and lands back after a valid seeded sign-in', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()

    await signInAs(page, seedCredentials.alice)
    // Return-to: the remembered destination, not the default landing.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()
  })

  test('/admin redirects to /signin and lands back after the super-admin sign-in', async ({
    page,
  }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()

    await signInAs(page, seedCredentials.platformAdmin)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Super Admin' })).toBeVisible()
  })
})

test.describe('seeded sign-ins land on the correct area per role', () => {
  test('owner (alice) lands on the staff dashboard by default', async ({ page }) => {
    await signInAs(page, seedCredentials.alice)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()
  })

  test('cashier (carla) lands on the staff dashboard with own-branch scope', async ({ page }) => {
    await signInAs(page, seedCredentials.carla)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()
    // The seeded cashier scope: Blue Olive — cashier — Downtown.
    await expect(page.getByText('Blue Olive — cashier — Downtown')).toBeVisible()
  })

  test('platform super admin (no memberships) lands on /admin by default', async ({ page }) => {
    await signInAs(page, seedCredentials.platformAdmin)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Super Admin' })).toBeVisible()
  })
})

test('deep link to /dashboard/staff as cashier renders NotAuthorized — rejected, not hidden (FR-014)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/dashboard/staff')
  await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()
  // Rejected in place — the deep link is not redirected away or blanked out.
  await expect(page).toHaveURL(/\/dashboard\/staff$/)
})

test('the platform super admin reaches /admin on a direct deep link (FR-012)', async ({ page }) => {
  await signInAs(page, seedCredentials.platformAdmin)
  await expect(page).toHaveURL(/\/admin$/)

  // Full page load on the deep link — the persisted session carries the visit.
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Super Admin' })).toBeVisible()
  await expect(page.getByText('platform super-admin capability')).toBeVisible()
})

test.describe('self-service password change (spec 020, FR-002/FR-006/FR-013/FR-014)', () => {
  test('the nav link is absent for anonymous visitors and present for signed-in identities', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Account password' })).toHaveCount(0)

    await signInAs(page, seedCredentials.carla)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('link', { name: 'Account password' })).toBeVisible()
  })

  test('the full walkthrough: refusals, both-facts confirmation, old password dead', async ({
    page,
  }) => {
    await signInAs(page, seedCredentials.fiona)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('link', { name: 'Account password' }).click()
    await expect(page).toHaveURL(/\/account\/password$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Account password' })).toBeVisible()

    // Hygiene: the flow's page carries no query parameters (SC-003a) and the
    // form fields are password-typed.
    expect(page.url()).not.toContain('?')
    for (const id of [
      'account-password-current',
      'account-password-new',
      'account-password-confirm',
    ]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute('type', 'password')
    }

    // Wrong current password → the ONE distinct message; the account is
    // unchanged (proven by the successful change below).
    await page.getByLabel('Current password').fill('not-the-fiona-password')
    await page.getByLabel('New password', { exact: true }).fill('dev-fiona-020-temp')
    await page.getByLabel('Confirm new password').fill('dev-fiona-020-temp')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'The current password is incorrect. Check it and try again.',
    )

    // Confirmation mismatch → the LOCAL message before any platform call.
    await page.getByLabel('Current password').fill(seedCredentials.fiona.password)
    await page.getByLabel('New password', { exact: true }).fill('dev-fiona-020-temp')
    await page.getByLabel('Confirm new password').fill('different-thing')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('alert')).toHaveText('The two passwords do not match.')

    // The real change → the both-facts confirmation (FR-007, US3 scenario 2).
    await page.getByLabel('Current password').fill(seedCredentials.fiona.password)
    await page.getByLabel('Confirm new password').fill('dev-fiona-020-temp')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Your password has been changed. This device stays signed in; other signed-in devices have been signed out.',
    )

    // Fresh authentication: old dead, new accepted (FR-013) — sign out, then
    // try the old password from the sign-in page (the generic sign-in
    // failure) and the new one (success). /account/password is not a guarded
    // route, so sign-out leaves its URL in place — the walk navigates home
    // first, like the standing sign-out suite does.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByRole('heading', { level: 1, name: 'Account password' }).waitFor()
    await expect(page.getByText('Sign in first to change your account password')).toBeVisible()
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/signin')
    await page.getByLabel('Email').fill(seedCredentials.fiona.email)
    await page.getByLabel('Password').fill(seedCredentials.fiona.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'Sign-in failed. Check your email and password, then try again.',
    )
    await page.getByLabel('Password').fill('dev-fiona-020-temp')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    // Storage hygiene after the whole flow: no password substring persisted
    // anywhere client-side (SC-003a).
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
    }))
    expect(storage.local).not.toContain('dev-fiona-020-temp')
    expect(storage.local).not.toContain('not-the-fiona-password')
    expect(storage.session).not.toContain('dev-fiona-020-temp')

    // Restore fiona's fixture password through the SAME flow (no API-side
    // credential writes in e2e — the surface under test is the only writer).
    await page.getByRole('link', { name: 'Account password' }).click()
    await expect(page).toHaveURL(/\/account\/password$/)
    await page.getByLabel('Current password').fill('dev-fiona-020-temp')
    await page.getByLabel('New password', { exact: true }).fill(seedCredentials.fiona.password)
    await page.getByLabel('Confirm new password').fill(seedCredentials.fiona.password)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('duplicate submits are prevented while the change is in flight (FR-011, Edge Cases)', async ({
    page,
  }) => {
    await signInAs(page, seedCredentials.fiona)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('link', { name: 'Account password' }).click()
    await expect(page).toHaveURL(/\/account\/password$/)

    // Hold the platform's verify response open so the in-flight state is
    // observably stable, then attempt a second submission while held.
    await page.getByLabel('Current password').fill('wrong-on-purpose')
    await page.getByLabel('New password', { exact: true }).fill('unused-new-1')
    await page.getByLabel('Confirm new password').fill('unused-new-1')
    const verifyHeld = page.route('**/auth/v1/token**', () => new Promise(() => undefined))
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('button', { name: 'Changing your password…' })).toBeDisabled()
    await page.getByRole('button', { name: 'Changing your password…' }).click({ force: true })
    // Still exactly one in-flight presentation — the disabled button absorbed
    // the forced click and no second platform call was possible from the UI.
    await expect(page.getByRole('button', { name: 'Changing your password…' })).toBeDisabled()
    await verifyHeld
    await page.unroute('**/auth/v1/token**')

    // Refresh mid-operation: the form returns to neutral, nothing persisted
    // (Edge Cases — refresh returns the form to its neutral state).
    await page.reload()
    await expect(page.getByRole('button', { name: 'Change password' })).toBeVisible()
    await expect(page.getByLabel('Current password')).toHaveValue('')
  })

  test('the super admin gets the same surface and the same rules (FR-014) — no password changed', async ({
    page,
  }) => {
    await signInAs(page, seedCredentials.platformAdmin)
    await expect(page).toHaveURL(/\/admin$/)
    await page.getByRole('link', { name: 'Account password' }).click()
    await expect(page).toHaveURL(/\/account\/password$/)
    await page.getByLabel('Current password').fill('deliberately-wrong')
    await page.getByLabel('New password', { exact: true }).fill('whatever-new-1')
    await page.getByLabel('Confirm new password').fill('whatever-new-1')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      'The current password is incorrect. Check it and try again.',
    )
  })
})

test.describe('session persistence across a page reload (FR-016)', () => {
  test('a signed-in member stays signed in with the same identity and scope', async ({ page }) => {
    await signInAs(page, seedCredentials.carla)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()

    // Full page reload — the app boots from scratch and the SDK must restore
    // the persisted session (no redirect to /signin, no signed-out flash).
    await page.reload()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()

    // Same identity and effective scope as before the reload.
    await expect(page.getByText('Signed in as Carla.')).toBeVisible()
    await expect(page.getByText('Blue Olive — cashier — Downtown')).toBeVisible()
  })
})

test.describe('sign-out ends the session and re-protects the staff areas (FR-017)', () => {
  test('after signing out, /dashboard and /admin redirect to /signin until re-authentication', async ({
    page,
  }) => {
    await signInAs(page, seedCredentials.alice)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()

    // Local scope: ends only this device's session; the guards see the
    // SIGNED_OUT event and redirect immediately.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff sign-in' })).toBeVisible()

    // Both protected areas require re-authentication — the signed-out
    // visitor is redirected away, and no staff data renders.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/signin$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/signin$/)

    // Staff data becomes reachable again only through a new sign-in. The
    // navigation home first starts a fresh history entry — the sign-in that
    // follows must land on the default staff landing, not on a stale
    // return-to left over from the redirect checks above.
    await page.goto('/')
    await signInAs(page, seedCredentials.alice)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()
    await expect(page.getByText('Signed in as Alice.')).toBeVisible()
  })
})
