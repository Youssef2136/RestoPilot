import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'

/**
 * Operational state honesty E2E — US1 block (spec 037 T008; SC-002; SC-004;
 * FR-05/FR-06/FR-07).
 *
 * DETERMINISTIC FAILURE INJECTION ONLY (the spec's forbidden list respected):
 * every failure below is injected through Playwright routing
 * (`page.route`/`route.fulfill`) or the context's built-in offline simulation
 * (`context.setOffline`) — the same result on every run. No Wi-Fi tricks, no
 * timing races, no "hope the request fails".
 *
 * The legs run against the seeded fixture's kept-free surface: Downtown T3 is
 * free after a reset (the seed keeps it open for exactly this), and the joins
 * queue on the shared entry lock (the platform kill-switch race).
 */

const SLUG = 'blue-olive'

// The file runs serially in one worker: each test opens and closes its own
// session on T3 (the second test's submit depends on its own join).
test.describe.configure({ mode: 'serial' })

async function joinTable3(page: Page, name: string, phone: string): Promise<void> {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill(phone)
  await withEntryLock(() => page.getByRole('button', { name: 'Join the table' }).click())
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
}

test('offline oversight: the last-known list stays readable and the writing action disables with the reason (FR-07)', async ({
  browser,
}) => {
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await joinTable3(guestPage, 'State Offline', '+15559100001')

  const staff = await browser.newContext()
  const staffPage = await staff.newPage()
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/sessions')
  await expect(staffPage.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  const t3row = staffPage.getByRole('listitem').filter({ hasText: 'T3' })
  await expect(t3row).toContainText('State Offline')

  // Offline (injected, deterministic).
  await staffPage.context().setOffline(true)
  const banner = staffPage.getByRole('status').filter({ hasText: "You're offline" })
  await expect(banner).toBeVisible()
  // The last-known list is still readable — staleness never blanks the view.
  await expect(t3row).toContainText('State Offline')

  // The writing action disables with the reason (blocked, never hidden).
  await t3row.getByRole('button', { name: 'Close session for T3' }).click()
  const confirm = staffPage.getByRole('button', { name: 'Confirm closing T3' })
  await expect(confirm).toBeDisabled()
  await staffPage.keyboard.press('Escape')

  // Back online: the banner recovers and the writing action re-enables.
  await staffPage.context().setOffline(false)
  await expect(banner).toBeHidden({ timeout: 8_000 })
  await t3row.getByRole('button', { name: 'Close session for T3' }).click()
  await expect(confirm).toBeEnabled()
  await staffPage.keyboard.press('Escape')

  await guest.close()
  await staff.close()
})

test('injected refusal on a transition: the verbatim message renders and the burst guard holds (FR-05, FR-06)', async ({
  browser,
}) => {
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await joinTable3(guestPage, 'State Refusal', '+15559100002')
  await guestPage.getByRole('button', { name: 'Add to cart' }).first().click()
  await guestPage.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(guestPage.getByText(/Round/i).first()).toBeVisible()

  const staff = await browser.newContext()
  const cashierPage = await staff.newPage()
  // Carla is the seeded Downtown cashier (fiona has NO membership until the
  // full-journey walkthrough creates one — standalone legs must use a seeded
  // cashier), so the rounds board is on her staff shell from sign-in.
  await signInAs(cashierPage, seedCredentials.carla)
  await cashierPage.getByRole('link', { name: 'Rounds' }).click()
  const roundCard = cashierPage.locator('[data-round-state="new"]').first()
  await expect(roundCard).toBeVisible()

  // Inject the refusal at the RPC boundary: accept_round fails with a
  // deterministic body; every other call passes through untouched.
  await cashierPage.route('**/rest/v1/rpc/accept_round', (route) =>
    route.fulfill({ status: 400, body: '{"message": "injected refusal — kitchen closed"}' }),
  )

  // First click: refused; the injected message renders verbatim ON the card.
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  const refusal = cashierPage.locator('[data-refusal]').first()
  await expect(refusal).toBeVisible()
  await expect(refusal).toContainText('injected refusal — kitchen closed')

  // The button's in-flight discipline (FR-06): a refused click leaves the
  // action re-enabled for an explicit retry (no stranded state), and a
  // rapid double-click cannot produce two refusals on the same card (the
  // pickRefusal routing renders ONE refusal per round card).
  await expect(roundCard.getByRole('button', { name: 'Accept round' })).toBeEnabled()
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  await expect(cashierPage.locator('[data-refusal]')).toHaveCount(1)

  await guest.close()
  await staff.close()
})
