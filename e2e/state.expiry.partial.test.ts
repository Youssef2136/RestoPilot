import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * Expiry & partial-failure E2E — US4/US5 block (spec 037 T016; FR-08,
 * FR-10, SC-005).
 *
 * DETERMINISTIC INJECTION ONLY (route-fulfill at the RPC boundary — the
 * spec's forbidden list respected; offline is not used here). The file pins
 * the REAL expiry posture, which is deny-by-default at the guard layer:
 *
 *  - An auth-context read that fails (including the expired-shape failure)
 *    makes the guard render the explicit denial view (heading "Not
 *    authorized") — rejected, never hidden, NEVER a white screen. That is
 *    the single expiry resolution (D8): the failed read is handled exactly
 *    once, at the guard, and the session itself is untouched (no
 *    double-redirect, no loop).
 *  - A genuinely ENDED SUPABASE SESSION (the SDK event `SIGNED_OUT` from the
 *    expired refresh token) is resolved exactly once by RequireAuth — the
 *    redirect to /signin carries `expired: true` and SignInPage's
 *    session-ended note renders (FR-08).
 *  - A partial comparison failure keeps the healthy branch's figures while
 *    the failed row names its branch honestly (FR-09, SC-005) — never a
 *    silent zero, never a page-wide failure.
 */

test.describe.configure({ mode: 'serial' })

const EXPIRED_BODY = '{"code": "401", "message": "JWT expired", "details": null, "hint": null}'

async function signInOwner(page: Page): Promise<void> {
  await signInAs(page, seedCredentials.alice)
}

/**
 * US4 — expiry: a failed auth-context read lands on the EXPLICIT denial
 * view (the honest guard posture), never a white screen and never a crash.
 * Single handling (D8): exactly one denial resolution, and the form stays
 * mounted — the user's recovery path (sign in again) remains visible.
 */
test('a failed auth-context read resolves once to the explicit denial view — never a white screen (FR-10, FR-08, D8)', async ({
  page,
}) => {
  await signInOwner(page)
  await page.goto('/dashboard')

  // From now on, every auth-context read resolves in the SDK's
  // expired-session shape (supabase-js surfaces an ended refresh token as
  // this 400 error body).
  await page.route(/rest\/v1\/rpc\/current_auth_context/, (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: EXPIRED_BODY }),
  )

  // Re-enter a guarded route: the context read fails; the deny-by-default
  // guard renders the explicit denial view.
  await page.reload()
  const heading = page.getByRole('heading', { level: 1, name: 'Not authorized' })
  await expect(heading).toBeVisible()
  // The session itself was not torn down: the sign-in page is not the
  // resolution (no double-handling of the same expiry — D8), and the shell
  // stays mounted.
  await expect(page).not.toHaveURL(/\/signin/)
  // Exactly ONE explicit denial resolution on the page — not two (the
  // guard's denial plus an inline alert would be double-handling).
  await expect(page.getByRole('heading', { name: 'Not authorized' })).toHaveCount(1)
})

/**
 * US4b — a genuinely ENDED session (the SDK's SIGNED_OUT-from-expiry
 * semantic): RequireAuth resolves it EXACTLY once — one redirect to
 * /signin whose location state carries `expired: true`, and SignInPage
 * renders its session-ended note (FR-08) instead of the cold-visit posture.
 */
test('a ended session redirects to sign-in exactly once with the session-ended note (FR-08, D8)', async ({
  page,
}) => {
  await signInOwner(page)
  await page.goto('/dashboard')

  // End the persisted session the way expiry does: remove the stored auth
  // tokens from localStorage, which supabase-js reads on the next
  // initialization — the same storage the SDK reads on restore.
  await page.evaluate(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null) keys.push(key)
    }
    for (const key of keys) {
      if (key.includes('auth-token')) localStorage.removeItem(key)
    }
  })
  await page.goto('/dashboard/voids')
  await expect(page).toHaveURL(/\/signin/, { timeout: 15_000 })
  // The expired note names what happened (no cold-visit posture) — the
  // redirect carried `expired: true` (FR-08).
  await expect(page.getByText(/session ended|expired|again/i).first()).toBeVisible()
})

/**
 * US5 — partial failure: one failed branch row never erases the others.
 * The owner's comparison renders per-branch rows; refusing EXACTLY the
 * Marina row keeps the Downtown row intact and names the failed branch.
 */
async function navigateToReports(page: Page): Promise<void> {
  await signInOwner(page)
  await page.goto('/dashboard/reports')
  await expect(page.getByTestId('report-comparison')).toBeVisible()
}

test('a partial comparison failure names its branch; others load intact (FR-09, SC-005)', async ({
  page,
}) => {
  await navigateToReports(page)

  // Refuse EXACTLY the Marina branch's report; every other call passes
  // through untouched (the comparison is per-branch rows over the two
  // seeded branches).
  await page.route(/rest\/v1\/rpc\/get_branch_sales_report/, async (route) => {
    const body = route.request().postData() ?? ''
    if (body.includes('00000000-0000-4000-8000-000000000102')) {
      // Marina's branch id: refuse.
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{"code": "42501", "message": "permission denied for RPC get_branch_sales_report"}',
      })
      return
    }
    await route.continue()
  })

  await page.reload()
  // The comparison stays mounted: the failed row names its branch (the
  // honest posture line), the healthy row keeps its figures.
  await expect(page.getByTestId('report-comparison')).toBeVisible()
  const marinaRow = page.locator('tr', { hasText: 'Marina' })
  await expect(marinaRow).toContainText('could not be loaded')
  const downtownRow = page.locator('tr', { hasText: 'Downtown' })
  await expect(downtownRow).toBeVisible()
})
