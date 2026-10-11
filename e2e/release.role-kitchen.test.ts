import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'
import { withMarinaT1Lock } from './helpers/marinaT1Lock'

/**
 * specs/039 T007 — the KITCHEN's isolated role journey (US2/FR-02): dan
 * proves his primary task on the MARINA board (the money-free queue:
 * tickets move accepted→preparing→ready), plus one denial (a
 * kitchen-identity cannot reach the cashier's rounds SURFACE — the
 * surface-level role matrix denies before any data loads).
 */
const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** A Marina guest round (dan's own branch = the kitchen's scope). */
async function marinaGuestRound(page: Page, name: string): Promise<void> {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Marina' })
  await page.getByLabel('Table').selectOption({ label: 'T1' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill('+15559300002')
  await withEntryLock(() => page.getByRole('button', { name: 'Join the table' }).click())
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
}

test('kitchen: the Marina board runs its money-free ticket path; the rounds surface denies kitchen (FR-02)', async ({
  browser,
}) => {
  // Marina T1 is the seeded INACTIVE fixture: the owner activates it
  // through the real management surface INSIDE the T1 lock (the realtime
  // suite's established pattern — state-agnostic flip), and the deactivation
  // is restored after the kitchen leg.
  await withMarinaT1Lock(async () => {
    const alice = await browser.newPage()
    await signInAs(alice, seedCredentials.alice)
    await alice.goto('/dashboard/branches/00000000-0000-4000-8000-000000000102')
    const marinaRow = alice.getByRole('listitem').filter({ hasText: 'T1' })
    await marinaRow.waitFor({ state: 'visible', timeout: 10_000 })
    const reactivate = alice.getByRole('button', { name: 'Reactivate T1' })
    if (await reactivate.isVisible()) {
      await reactivate.click()
      await expect(alice.getByRole('button', { name: 'Deactivate T1' })).toBeVisible({
        timeout: 10_000,
      })
    }
    await alice.close()

    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const guestPage = await guest.newPage()
    await marinaGuestRound(guestPage, 'Release Kitchen Guest')
    await guestPage.close()

    const page = await browser.newPage({ viewport: { width: 1112, height: 834 } })
    await signInAs(page, seedCredentials.dan)

    // THE DENIAL first: dan (kitchen) has no rounds surface — the explicit
    // denial view, never data.
    await page.goto('/dashboard/rounds')
    await expect(page.getByRole('heading', { level: 1, name: 'Not authorized' })).toBeVisible()

    // Primary task: the Marina kitchen board runs the ticket path. The
    // LIVE-arrival wait is the realtime suite's established poll (the new
    // ticket's count grows live; its state may be 'accepted' or already
    // transitioning — the payload truth is the ticket's own controls).
    await page.goto('/dashboard/kitchen')
    await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()
    await expect
      .poll(async () => page.locator('article[data-ticket-id]').count(), {
        timeout: 15_000,
        message: 'the new ticket should arrive (live or on refetch)',
      })
      .toBeGreaterThan(0)
    const ticket = page.locator('article[data-ticket-id]').first()
    // MONEY-FREE board (the standing contract stays visible in the pass).
    const boardText = await page.locator('main').first().innerText()
    expect(boardText.toLowerCase()).not.toMatch(/subtotal/)
    // A NEW-state ticket awaits the cashier/owner's accept: Marina has NO
    // branch cashier (dan IS the kitchen) — the owner accepts through HER
    // rounds board (the owner's transition matrix), then the kitchen drives
    // its stateful half.
    const awaiting = ticket.getByText(/Awaiting cashier/i)
    if (await awaiting.isVisible()) {
      const acceptor = await browser.newPage()
      await signInAs(acceptor, seedCredentials.alice)
      await acceptor.goto('/dashboard/rounds')
      // The owner's rounds board defaults to its first branch — Marina's
      // pending round lives under the Marina scope of the branch combobox.
      await acceptor.getByLabel('Branch').selectOption({ label: 'Blue Olive — Marina' })
      const pendingCard = acceptor.locator('[data-round-state="new"]').first()
      await expect(pendingCard).toBeVisible({ timeout: 10_000 })
      await pendingCard.getByRole('button', { name: 'Accept round' }).click()
      await expect(acceptor.locator('[data-round-state="accepted"]').first()).toBeVisible()
      await acceptor.close()
      // The board's live payload flips the ticket to accepted (wait for
      // the START control to appear on the SAME ticket).
      await expect(
        page
          .locator('article[data-ticket-id]')
          .first()
          .getByRole('button', { name: 'Start preparation' }),
      ).toBeVisible({ timeout: 15_000 })
    }
    const startable = page.locator('article[data-ticket-id]').first()
    await startable.getByRole('button', { name: 'Start preparation' }).click()
    await expect(page.locator('[data-ticket-state="preparing"]').first()).toBeVisible({
      timeout: 15_000,
    })
    await page
      .locator('[data-ticket-state="preparing"]')
      .first()
      .getByRole('button', { name: 'Mark ready' })
      .click()
    await expect(page.locator('[data-ticket-state="ready"]').first()).toBeVisible({
      timeout: 15_000,
    })
    await page.close()

    // Restore the fixture: Marina T1 back to its seeded INACTIVE state
    // (state-agnostic, idempotent — same discipline as realtime's teardown).
    const aliceAgain = await browser.newPage()
    await signInAs(aliceAgain, seedCredentials.alice)
    await aliceAgain.goto('/dashboard/branches/00000000-0000-4000-8000-000000000102')
    const rowAgain = aliceAgain.getByRole('listitem').filter({ hasText: 'T1' })
    await rowAgain.waitFor({ state: 'visible', timeout: 10_000 })
    const deactivate = aliceAgain.getByRole('button', { name: 'Deactivate T1' })
    if (await deactivate.isVisible()) {
      await deactivate.click()
      await expect(aliceAgain.getByRole('button', { name: 'Reactivate T1' })).toBeVisible({
        timeout: 10_000,
      })
    }
    await aliceAgain.close()
  })
})
