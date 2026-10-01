import { expect, test, type Browser } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { withEntryLock } from './helpers/entryLock'
import { withMarinaT1Lock } from './helpers/marinaT1Lock'
import { signInAs } from './helpers/signInAs'

/**
 * Cashier operations E2E (specs/029 T012; FR-01/02/04/05/07, D2/D3): the
 * NEW operations suite riding the re-skinned board — the Master Plan's
 * "tablet-viewport operations pass, keyboard-only transition path,
 * reconnecting banner behavior".
 *
 * The Marina T1 scratch fixture carries the board journeys (the realtime
 * precedent): the seeded INACTIVE table is activated by the owner through
 * the management surface, a REAL customer submits through the public
 * surface, and the owner works the chain on `/dashboard/rounds?branch=`
 * — at the tablet landscape viewport (the cashier station) and at 390px
 * (mobile: read/alert-capable with key transitions operable). The whole
 * T1 lifecycle lives inside `withMarinaT1Lock` (cross-file mutex with
 * realtime's kitchen-queue test).
 *
 * The frozen journeys stay UNEDITED elsewhere; this file only ADDS.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** One real customer submission through the public surface (entry lock). */
async function submitCustomerRound(
  browser: Browser,
  branchLabel: string,
  tableLabel: string,
  itemName: string,
  name: string,
  phone: string,
): Promise<void> {
  const page = await browser.newPage()
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: branchLabel })
    await page.getByLabel('Table').selectOption({ label: tableLabel })
    await page.getByLabel('Your name').fill(name)
    await page.getByLabel('Phone number').fill(phone)
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()
  const itemLine = page.locator('li', { hasText: itemName }).first()
  await itemLine.getByRole('button', { name: 'Add to cart' }).click()
  await page
    .getByRole('region', { name: 'Cart' })
    .getByRole('button', { name: /send order/i })
    .click()
  await expect(page.getByText(/your order is in/i)).toBeVisible()
  await page.close()
}

/**
 * The state-agnostic T1 activation (realtime's self-healing flip): a
 * crashed earlier run can leave T1 Active, so drive to Active from
 * whatever state renders — the toggle label is the oracle. Caller holds
 * the Marina T1 lock.
 */
async function ensureMarinaT1Active(browser: Browser): Promise<void> {
  const page = await browser.newPage()
  await signInAs(page, seedCredentials.alice)
  await page.goto(`/dashboard/branches/${branchIds.marina}`)
  const marinaRow = page.getByRole('listitem').filter({ hasText: 'T1' })
  await marinaRow.waitFor({ state: 'visible', timeout: 10_000 })
  const reactivate = page.getByRole('button', { name: 'Reactivate T1' })
  if (await reactivate.isVisible()) {
    await reactivate.click()
    await expect(page.getByRole('button', { name: 'Deactivate T1' })).toBeVisible({
      timeout: 10_000,
    })
  }
  await page.close()
}

/** The state-agnostic T1 deactivation (the fixture's seeded posture). */
async function ensureMarinaT1Inactive(browser: Browser): Promise<void> {
  const page = await browser.newPage()
  await signInAs(page, seedCredentials.alice)
  await page.goto(`/dashboard/branches/${branchIds.marina}`)
  const marinaRow = page.getByRole('listitem').filter({ hasText: 'T1' })
  await marinaRow.waitFor({ state: 'visible', timeout: 10_000 })
  await expect(async () => {
    const deactivate = page.getByRole('button', { name: 'Deactivate T1' })
    if (await deactivate.isVisible()) {
      await deactivate.click()
    }
    await expect(marinaRow).toContainText('Inactive')
  }).toPass({ timeout: 20_000 })
  await page.close()
}

test('the cashier works a real Marina round on a tablet viewport: board groups, keyboard-only chain, bill, freshness (FR-01/02/05/07)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus', 'E2E Ops Customer', '+15550777')

    // Tablet landscape — the cashier station viewport (Master Plan §Phase 09).
    await page.setViewportSize({ width: 1024, height: 768 })
    await signInAs(page, seedCredentials.alice)
    await page.goto(`/dashboard/rounds?branch=${branchIds.marina}`)

    // The board: state groups as LABELLED REGIONS with counts (FR-01).
    await expect(page.getByRole('region', { name: 'New orders' })).toBeVisible()

    const incoming = page.locator('[data-round-state="new"]').first()
    await expect(incoming).toBeVisible()
    await expect(incoming).toContainText('Hummus')

    // The freshness badge ticks from the reads (FR-07, D2).
    await expect(page.getByTestId('queue-updated')).toContainText(/Updated (just now|\d+s ago)/)

    // Accept (mouse), then walk the chain KEYBOARD-ONLY: focus + Enter on
    // each state-legal control (no clicks from here).
    await incoming.getByRole('button', { name: 'Accept round' }).click()
    const accepted = page.locator('[data-round-state="accepted"]').first()
    await expect(accepted).toBeVisible()
    await accepted.getByRole('button', { name: 'Start preparation' }).focus()
    await page.keyboard.press('Enter')
    const preparing = page.locator('[data-round-state="preparing"]').first()
    await expect(preparing).toBeVisible()
    await preparing.getByRole('button', { name: 'Mark ready' }).focus()
    await page.keyboard.press('Enter')
    const readyCard = page.locator('[data-round-state="ready"]').first()
    await expect(readyCard).toBeVisible()
    await readyCard.getByRole('button', { name: 'Lock round' }).focus()
    await page.keyboard.press('Enter')
    const locked = page
      .locator('article[data-round-state="lock"]:not([data-voided="true"])')
      .first()
    await expect(locked).toBeVisible()

    // The bill inline on 'Show bill' (FR-05, D1): the printed check with
    // the server's grand total.
    await locked.getByLabel('Show bill').check()
    const bill = page.getByTestId('session-bill')
    await expect(bill).toBeVisible()
    await expect(bill.getByTestId('bill-grand-total')).toContainText(/Grand total/)

    // The axe floor on the populated tablet board.
    await expectNoNewViolations(page, { route: '/dashboard/rounds' })

    // Restore the fixture posture for the rest of the run.
    await ensureMarinaT1Inactive(browser)
  })
})

test('mobile posture (390px): the void journey stays operable with a mandatory reason (FR-04)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus', 'E2E Mobile Customer', '+15550778')

    await page.setViewportSize({ width: 390, height: 844 })
    await signInAs(page, seedCredentials.alice)
    await page.goto(`/dashboard/rounds?branch=${branchIds.marina}`)

    // Mobile is read/alert-capable with KEY transitions operable: drive a
    // real round to the dine-in void boundary and void it with a reason.
    const incoming = page.locator('[data-round-state="new"]').first()
    await expect(incoming).toBeVisible()
    await incoming.getByRole('button', { name: 'Accept round' }).click()
    await expect(page.locator('[data-round-state="accepted"]').first()).toBeVisible()
    await page
      .locator('[data-round-state="accepted"]')
      .first()
      .getByRole('button', { name: 'Start preparation' })
      .click()
    await expect(page.locator('[data-round-state="preparing"]').first()).toBeVisible()
    await page
      .locator('[data-round-state="preparing"]')
      .first()
      .getByRole('button', { name: 'Mark ready' })
      .click()
    await expect(page.locator('[data-round-state="ready"]').first()).toBeVisible()
    await page
      .locator('[data-round-state="ready"]')
      .first()
      .getByRole('button', { name: 'Lock round' })
      .click()
    const locked = page
      .locator('article[data-round-state="lock"]:not([data-voided="true"])')
      .first()
    await expect(locked).toBeVisible()
    const roundId = await locked.getAttribute('data-round-id')
    expect(roundId).toBeTruthy()
    // Scope EVERY dialog interaction to THIS round's card: sibling lock
    // cards (earlier journeys) each hold a closed dialog with their own
    // 'Void reason' input — the page-level lookup would strict-collide.
    const myCard = page.locator(`article[data-round-id="${roundId}"]`)

    // The void prompt: the confirm stays disabled until a reason exists,
    // then the voided display state lands on the card (the overlay).
    await myCard.getByRole('button', { name: 'Void round' }).click()
    await expect(myCard.getByRole('button', { name: 'Confirm void' })).toBeDisabled()
    await myCard.getByLabel('Void reason').fill('E2E: mobile void')
    await myCard.getByRole('button', { name: 'Confirm void' }).click()
    await expect(
      page.locator(`article[data-round-id="${roundId}"][data-voided="true"]`),
    ).toBeVisible()
    await expect(
      page.locator(`article[data-round-id="${roundId}"][data-voided="true"]`),
    ).toContainText('E2E: mobile void')

    await ensureMarinaT1Inactive(browser)
  })
})

test('the reconnecting banner reports a dropped connection and clears on recovery (FR-07, D2)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')
  await expect(page.getByRole('heading', { name: 'Rounds' })).toBeVisible()

  // The transport drops: the binding's status callback (CHANNEL_ERROR —
  // after TIMED_OUT/CLOSED variants) lands the polite banner; the last
  // known board stays readable.
  await page.context().setOffline(true)
  await expect(page.getByTestId('reconnecting-banner')).toBeVisible({ timeout: 30_000 })

  // The client's auto-reconnect fires SUBSCRIBED — the banner clears and
  // the recovery refetch reconciles anything missed (the binding's own
  // posture, unchanged).
  await page.context().setOffline(false)
  await expect(page.getByTestId('reconnecting-banner')).toBeHidden({ timeout: 60_000 })
})

test('the sessions oversight panel holds the axe floor after the re-skin (FR-06)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/sessions')
  await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  await expectNoNewViolations(page, { route: '/dashboard/sessions' })
})
