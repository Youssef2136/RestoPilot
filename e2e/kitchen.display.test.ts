import { expect, test } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { withEntryLock } from './helpers/entryLock'
import { withMarinaT1Lock } from './helpers/marinaT1Lock'
import { signInAs } from './helpers/signInAs'

/**
 * Kitchen display E2E (specs/030 T008; SC-01…SC-03): the NEW display suite
 * riding the re-skinned KDS — the Master Plan's "offline/reconnect behavior
 * (simulated by context offline), reload recovery mid-service, landscape
 * tablet viewport pass, axe checks" plus the money/address absences
 * re-asserted explicitly.
 *
 * Marina T1 carries the journey (the realtime + cashier.operations
 * precedent): the seeded INACTIVE table is activated by the owner through
 * the management surface, a REAL customer submits through the public
 * surface, and dan (kitchen at Marina) works the board. The whole T1
 * lifecycle lives inside `withMarinaT1Lock`.
 *
 * The frozen journeys (kitchen.cashier, realtime, full-journey) stay
 * UNEDITED; this file only ADDS.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** One real customer submission through the public surface (entry lock). */
async function submitCustomerRound(
  browser: import('@playwright/test').Browser,
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

/** The state-agnostic T1 activation (the self-healing flip). */
async function ensureMarinaT1Active(browser: import('@playwright/test').Browser): Promise<void> {
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
async function ensureMarinaT1Inactive(browser: import('@playwright/test').Browser): Promise<void> {
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

test('the cook works a real Marina ticket on the landscape board: live arrival, keyboard-only walk, counts, axe (SC-01)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus', 'E2E KDS Customer', '+15550781')

    // Landscape tablet — the KDS viewport (≥1024 touch).
    await page.setViewportSize({ width: 1280, height: 800 })
    await signInAs(page, seedCredentials.dan)
    await page.goto('/dashboard/kitchen')
    await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

    // The board: three LABELLED columns with counts (FR-01, D3) — divs,
    // deliberately not regions (the route's frozen single-`section` pin),
    // named through the aria-label + heading structure.
    await expect(page.locator('[data-kitchen-column="new"]')).toBeVisible()
    await expect(page.locator('[data-kitchen-column="preparing"]')).toBeVisible()
    await expect(page.locator('[data-kitchen-column="ready"]')).toBeVisible()
    await expect(page.locator('[data-kitchen-column="new"]')).toHaveAttribute(
      'aria-label',
      'Incoming (awaiting cashier)',
    )

    // The ticket arrives LIVE through the coalesced invalidation — the
    // T1 submit happened BEFORE dan opened the board, so the mounted read
    // renders it; its card shows the item and the honest age (FR-03).
    const incoming = page.locator('[data-ticket-state="new"]').first()
    await expect(incoming).toBeVisible()
    await expect(incoming).toContainText('Hummus')
    await expect(incoming).toContainText(/\d+ min/)
    // A ticket without a table never prints 'Table null' (the D3 edge).
    await expect(incoming).not.toContainText('Table null')

    // The freshness badge ticks from the reads (the 029 component reused).
    await expect(page.getByTestId('queue-updated')).toContainText(/Updated (just now|\d+s ago)/)

    // The contract's split: the cashier accepts first — dan's board shows
    // the new ticket with NO action button; alice accepts on the rounds
    // board, and dan's OPEN board moves the ticket columns LIVE (SC-01's
    // "moved tickets visibly change columns"), then the keyboard-only walk
    // runs on the large controls (focus + Enter, no clicks).
    await expect(incoming.getByRole('button')).toHaveCount(0)
    const alice = await browser.newPage()
    await signInAs(alice, seedCredentials.alice)
    await alice.goto(`/dashboard/rounds?branch=${branchIds.marina}`)
    // The accept click retries through the hydration window — the binding's
    // SUBSCRIBED recovery refetch re-renders the board right after mount and
    // can swallow a click (the realtime suite's self-healing lesson) — and
    // the PREMISE is asserted on alice's own board before dan's live move
    // is judged (a silent failed accept would otherwise read as a realtime
    // failure and mislead the diagnosis).
    await expect(async () => {
      const accept = alice
        .locator('[data-round-state="new"]')
        .first()
        .getByRole('button', { name: 'Accept round' })
      if ((await accept.count()) > 0) {
        await accept.click()
      }
      await expect(alice.locator('[data-round-state="accepted"]').first()).toBeVisible({
        timeout: 5_000,
      })
    }).toPass({ timeout: 45_000 })
    await expect(
      page.locator('[data-ticket-state="accepted"]').first(),
      "dan's board moves the ticket to In preparation live",
    ).toBeVisible({ timeout: 20_000 })
    await alice.close()

    const accepted = page.locator('[data-ticket-state="accepted"]').first()
    await accepted.getByRole('button', { name: 'Start preparation' }).focus()
    await page.keyboard.press('Enter')
    const preparing = page.locator('[data-ticket-state="preparing"]').first()
    await expect(preparing).toBeVisible()
    await preparing.getByRole('button', { name: 'Mark ready' }).focus()
    await page.keyboard.press('Enter')
    const ready = page.locator('[data-ticket-state="ready"]').first()
    await expect(ready).toBeVisible()
    // The ready ticket offers no further action on the kitchen board —
    // the cashier takes it from here (the contract's two actions only).
    await expect(ready.getByRole('button')).toHaveCount(0)

    // The axe floor on the populated landscape board.
    await expectNoNewViolations(page, { route: '/dashboard/kitchen' })

    await ensureMarinaT1Inactive(browser)
  })
})

test('reload mid-service renders the authoritative columns (SC-02, FR-06)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus', 'E2E Reload Customer', '+15550782')

    await page.setViewportSize({ width: 1280, height: 800 })
    await signInAs(page, seedCredentials.dan)
    await page.goto('/dashboard/kitchen')
    const incoming = page.locator('[data-ticket-state="new"]').first()
    await expect(incoming).toBeVisible()

    // Reload mid-service: state from the server, never client memory —
    // the ticket renders again through the normal load path (FR-06).
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()
    await expect(page.locator('[data-ticket-state="new"]').first()).toBeVisible()
    await expect(page.locator('[data-ticket-state="new"]').first()).toContainText('Hummus')

    await ensureMarinaT1Inactive(browser)
  })
})

test('the offline board shows the reconnecting banner and recovers (SC-02, FR-05)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, seedCredentials.dan)
  await page.goto('/dashboard/kitchen')
  await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  // The transport drops: the ticket binding's status callback lands the
  // polite banner; the last-known board stays readable (never blank).
  await page.context().setOffline(true)
  await expect(page.getByTestId('reconnecting-banner')).toBeVisible({ timeout: 30_000 })

  // The client's auto-reconnect fires SUBSCRIBED — the banner clears and
  // the recovery refetch reconciles anything missed (the binding's posture).
  await page.context().setOffline(false)
  await expect(page.getByTestId('reconnecting-banner')).toBeHidden({ timeout: 60_000 })
})

test('the board stays money-free and address-free live; the 390px fallback stays readable (SC-03, FR-09)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus', 'E2E Blind Customer', '+15550783')

    await signInAs(page, seedCredentials.dan)
    await page.goto('/dashboard/kitchen')
    await expect(page.locator('[data-ticket-state="new"]').first()).toBeVisible()

    // The double-blind re-assert over the LIVE board (the frozen kitchen
    // pins read the ROOT `section` text — this extends them to the address).
    const boardText = await page.locator('section').innerText()
    expect(boardText).not.toMatch(/subtotal|tax|total|price/i)
    expect(boardText).not.toContain('Deliver to')
    expect(boardText).not.toContain('12 Marina Walk')

    // The phone posture: explicitly NOT a working surface — the readable
    // stacked fallback (the columns stack; nothing overflows horizontally).
    await page.setViewportSize({ width: 390, height: 844 })
    const incoming = page.locator('[data-ticket-state="new"]').first()
    await expect(incoming).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)

    await ensureMarinaT1Inactive(browser)
  })
})
