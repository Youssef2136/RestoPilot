import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'

/**
 * specs/039 T006 — the CASHIER's isolated role journey (US2/FR-02): carla
 * proves her primary task on a REAL guest round (accept → lock), the void
 * prompt's honest gate, and one verbatim refusal (a documented injection —
 * accept_round refuses and the refusal is the message).
 */
const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

async function guestRoundOn(page: Page, name: string): Promise<void> {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill('+15559300001')
  await withEntryLock(() => page.getByRole('button', { name: 'Join the table' }).click())
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
}

test('cashier: a real guest round flows accept→lock; the injected refusal renders verbatim (FR-02)', async ({
  browser,
}) => {
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const guestPage = await guest.newPage()
  await guestRoundOn(guestPage, 'Release Cashier Guest')
  await guestPage.close()

  const page = await browser.newPage()
  await signInAs(page, seedCredentials.carla)
  await page.getByRole('link', { name: 'Rounds' }).click()
  const roundCard = page.locator('[data-round-state="new"]').first()
  await expect(roundCard).toBeVisible()

  // THE STATE CHECK (a verbatim refusal): accept_round is refused on the
  // FIRST click; the injected body renders inline verbatim at the card.
  await page.route('**/rest/v1/rpc/accept_round', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"message": "release-role injected refusal", "code": "P0001"}',
    }),
  )
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  const refusal = page.locator('[data-refusal]').first()
  await expect(refusal).toBeVisible()
  await expect(refusal).toContainText('release-role injected refusal')
  await page.unroute('**/rest/v1/rpc/accept_round')

  // The explicit retry lands: the round accepts and moves forward.
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  await expect(page.locator('[data-round-state="accepted"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="accepted"]')
    .first()
    .getByRole('button', { name: 'Start preparation' })
    .click()
  const preparingCard = page.locator('[data-round-state="preparing"]').first()
  await expect(preparingCard).toBeVisible()
  await preparingCard.getByRole('button', { name: 'Mark ready' }).click()
  await expect(page.locator('[data-round-state="ready"]').first()).toBeVisible()
  const readyFirst = page.locator('[data-round-state="ready"]').first()
  await readyFirst.getByRole('button', { name: 'Lock round' }).click()
  await expect(page.locator('[data-round-state="lock"]').first()).toBeVisible()
})
