import { expect, test, type Browser, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'
import { signInAs } from './helpers/signInAs'
import { VIEWPORTS } from './helpers/responsive'

/**
 * The cashier at tablet landscape (spec 036 FR-04/SC-003, W2; table-landscape
 * IS the clarified primary cashier form factor). A real guest round is
 * submitted through the public surface, then the CASHIER (carla) works
 * assign → show bill → close at the 1112×834 station — every control visible
 * and operable without horizontal scrolling, dialogs fitting the rotated
 * viewport, action targets inside it. The T2 lifecycle lives under its lock
 * (the keyboard-close session spec owns the same fixture's close flow — the
 * two locks keep them exclusive).
 */

test.describe.configure({ mode: 'serial' })

const SLUG = 'blue-olive'

async function submitGuestRound(browser: Browser): Promise<void> {
  const guest = await browser.newPage()
  await withEntryLock(async () => {
    await guest.goto(`/r/${SLUG}`)
    await guest.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await guest.getByLabel('Table').selectOption({ label: 'T2' })
    await guest.getByLabel('Your name').fill('Landscape Cashier Guest')
    await guest.getByLabel('Phone number').fill('+15557477005')
    await guest.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(guest).toHaveURL(/\/r\/blue-olive\/menu$/)
  await guest
    .locator('li')
    .filter({ hasText: 'Hummus' })
    .first()
    .getByRole('button', { name: 'Add to cart' })
    .click()
  await expect(guest.getByText('Hummus added to your cart.')).toBeVisible()
  await guest
    .getByRole('region', { name: 'Cart' })
    .getByRole('button', { name: /send order/i })
    .click()
  await expect(guest.getByText(/your order is in/i)).toBeVisible()
  await guest.close()
}

/**
 * Reachable at the landscape station: visible and inside the HORIZONTAL
 * bounds (the harm FR-04 bans is horizontal scroll/clipping — vertical reach
 * is normal scrolling, and Playwright auto-scrolls before acting). The FULL
 * both-axes fit is asserted separately for DIALOGS (expectDialogFits).
 */
async function expectReachable(locator: ReturnType<Page['locator']>): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, 'control must render inside the landscape viewport').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.tabletLandscape.width)
}

/** A dialog must genuinely FIT the rotated viewport (both axes). */
async function expectDialogFits(dialog: ReturnType<Page['locator']>): Promise<void> {
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box, 'the dialog must fit the landscape viewport').not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.tabletLandscape.width)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORTS.tabletLandscape.height)
}

test('the cashier works assign → bill → close at the 1112×834 landscape station', async ({
  page,
  browser,
}) => {
  // The T2 lock can wait behind the parallel workers (the mutex needs real
  // time when the project suite shares it); the timeout covers that wait.
  test.setTimeout(600_000)
  await withT2Lock(async () => {
    await submitGuestRound(browser)

    const station = VIEWPORTS.tabletLandscape
    await page.setViewportSize({ width: station.width, height: station.height })
    await signInAs(page, seedCredentials.carla)

    // ── assign (the round board). ──────────────────────────────────────────
    await page.goto(`/dashboard/rounds?branch=${branchIds.downtown}`)
    const incoming = page.locator('[data-round-state="new"]').first()
    await expect(incoming).toBeVisible()
    await expect(incoming).toContainText('Hummus')
    await expectReachable(incoming.getByRole('button', { name: 'Accept round' }))
    await incoming.getByRole('button', { name: 'Accept round' }).click()
    const accepted = page.locator('[data-round-state="accepted"]').first()
    await expect(accepted).toBeVisible()
    await expectReachable(accepted.getByRole('button', { name: 'Start preparation' }))
    await accepted.getByRole('button', { name: 'Start preparation' }).click()
    const preparing = page.locator('[data-round-state="preparing"]').first()
    await expect(preparing).toBeVisible()
    await expectReachable(preparing.getByRole('button', { name: 'Mark ready' }))
    await preparing.getByRole('button', { name: 'Mark ready' }).click()
    const readyCard = page.locator('[data-round-state="ready"]').first()
    await expect(readyCard).toBeVisible()
    await expectReachable(readyCard.getByRole('button', { name: 'Lock round' }))
    await readyCard.getByRole('button', { name: 'Lock round' }).click()
    const locked = page
      .locator('article[data-round-state="lock"]:not([data-voided="true"])')
      .first()
    await expect(locked).toBeVisible()

    // ── the bill inline (no horizontal scroll to reach it). ───────────────
    const showBill = locked.getByLabel('Show bill')
    await expect(async () => {
      await showBill.click()
      await expect(page.getByTestId('session-bill')).toBeVisible()
    }).toPass({ timeout: 45_000 })
    const bill = page.getByTestId('session-bill')
    await expect(bill.getByTestId('bill-grand-total')).toContainText(/Grand total/)
    await expectReachable(bill.getByTestId('bill-grand-total'))

    // ── close session at the station (the landscape dialogs fit). ─────────
    await page.goto('/dashboard/sessions')
    const row = page.getByRole('listitem').filter({ hasText: 'T2' }).first()
    const closeTrigger = row.getByRole('button', { name: 'Close session for T2' })
    await expectReachable(closeTrigger)
    await closeTrigger.click()
    const dialog = page.getByRole('dialog')
    await expectDialogFits(dialog)
    const confirm = page.getByRole('button', { name: 'Confirm closing T2' })
    await expectReachable(confirm)
    await confirm.click()
    await expect(page.getByRole('status')).toContainText(/T2.s session was closed/)

    // The landscape station never scrolls horizontally to work the chain.
    const overflow = await page.evaluate(
      () =>
        (document.scrollingElement?.scrollWidth ?? 0) -
        (document.scrollingElement?.clientWidth ?? 0),
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('the landscape void dialog fits the rotated viewport (fields and actions intact)', async ({
  page,
  browser,
}) => {
  // Same T2-lock-wait headroom as the station journey.
  test.setTimeout(600_000)
  await withT2Lock(async () => {
    await submitGuestRound(browser)

    const station = VIEWPORTS.tabletLandscape
    await page.setViewportSize({ width: station.width, height: station.height })
    await signInAs(page, seedCredentials.carla)
    await page.goto(`/dashboard/rounds?branch=${branchIds.downtown}`)

    // Drive a round to the void boundary (lock) at the station. The ready
    // state group holds ONLY this journey's round (the first leg's round is
    // already terminal-locked) — capture its id before locking, then scope
    // EVERY dialog interaction to THIS round's card (the 029 pattern: sibling
    // lock cards hold their own closed 'Void reason' dialogs).
    const chain: [string, string][] = [
      ['[data-round-state="new"]', 'Accept round'],
      ['[data-round-state="accepted"]', 'Start preparation'],
      ['[data-round-state="preparing"]', 'Mark ready'],
    ]
    for (const [state, action] of chain) {
      const card = page.locator(state).first()
      await expect(card).toBeVisible()
      await card.getByRole('button', { name: action }).click()
    }
    const readyCard = page.locator('[data-round-state="ready"]').first()
    await expect(readyCard).toBeVisible()
    const roundId = await readyCard.getAttribute('data-round-id')
    expect(roundId).toBeTruthy()
    await readyCard.getByRole('button', { name: 'Lock round' }).click()
    const myCard = page.locator(`article[data-round-id="${roundId}"]`)
    await expect(myCard).toHaveAttribute('data-round-state', 'lock')

    // Open the void prompt at landscape: the dialog must FIT the rotated
    // viewport (both axes), with its reason field and confirm action intact.
    await myCard.getByRole('button', { name: 'Void round' }).click()
    const voidDialog = myCard.getByRole('dialog')
    await expectDialogFits(voidDialog)
    const reason = myCard.getByLabel('Void reason')
    await expect(reason).toBeVisible()
    await reason.fill('E2E: landscape void')
    const confirmVoid = myCard.getByRole('button', { name: 'Confirm void' })
    await expectReachable(confirmVoid)
    await expectDialogFits(voidDialog)
    await confirmVoid.click()
    await expect(
      page.locator(`article[data-round-id="${roundId}"][data-voided="true"]`),
    ).toBeVisible()
    await expect(myCard).toContainText('E2E: landscape void')
  })
})
