import { expect, type Page } from '@playwright/test'
import { withFionaLock } from './fionaLock'

/**
 * Signs a seeded identity in through the real /signin form.
 *
 * Resilience for the parallel suite (playwright fullyParallel: true):
 * several workers sign the SAME seeded identities in simultaneously, and
 * the shared auth endpoint rate-limits bursts (a 429 surfaces as the
 * generic sign-in failure). The bounded retry absorbs that: wait a beat,
 * re-fill the form, try again. Credential hygiene is unchanged — the
 * helper never writes credentials, only submits the form.
 *
 * `expectUrl` (default true) waits for the identity's default landing —
 * /dashboard for staff, /admin for the platform super admin; the auth.routes
 * walkthrough passes false because it asserts its own destinations.
 */
export async function signInAs(
  page: Page,
  credentials: { email: string; password: string },
  { expectUrl = true }: { expectUrl?: boolean } = {},
): Promise<void> {
  await page.goto('/signin')
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByLabel('Password').fill(credentials.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    try {
      if (expectUrl) {
        // The platform super admin has no memberships: its default landing is
        // /admin, not /dashboard (auth.routes pins both).
        await expect(page).toHaveURL(/\/(dashboard|admin)$/, { timeout: 10_000 })
      } else {
        await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({
          timeout: 10_000,
        })
      }
      return
    } catch (error) {
      // Last attempt: let the assertion throw in the caller's context.
      if (attempt === 3) throw error
      // A failed burst lands back on /signin (the generic failure alert).
      // Give the rate-limit window a beat, then resubmit.
      await page.waitForTimeout(1_500 * attempt)
      await page.goto('/signin')
    }
  }
}

/**
 * Fiona-specific sign-in: takes the shared-fixture lock so a parallel
 * worker's poisoned-password window (auth.routes walkthrough) can never
 * overlap this authentication. Non-Fiona callers use `signInAs` directly.
 */
export async function signInAsFiona(
  page: Page,
  credentials: { email: string; password: string },
  options?: { expectUrl?: boolean },
): Promise<void> {
  await withFionaLock(() => signInAs(page, credentials, options))
}
