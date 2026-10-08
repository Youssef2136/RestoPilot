import { expect, test, type Page, type Browser } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'
import { withMarinaT1Lock } from './helpers/marinaT1Lock'

/**
 * The keyboard-journey spec (spec 035 FR-02/FR-04; T005/T006): the critical
 * journeys the standing suites do not yet prove keyboard-only — customer
 * ordering end-to-end, the staff mobile drawer, the session close, and
 * super-admin onboarding — plus the focus rules (moves in on open, contained
 * while open, restores to the trigger on close, never stolen by live
 * updates). The proven cashier/kitchen keyboard walks live in their own
 * suites; this file is serial in one worker.
 *
 * Keyboard discipline: buttons are driven by focus + Enter (never click);
 * text fields by typing (fill); native <select> widgets by selectOption
 * (the browser's own keyboard semantics — a select IS keyboard-operable).
 * The cashier/kitchen walks set the precedent (focus + Enter chains).
 */

test.describe.configure({ mode: 'serial' })

/** Focuses the control and presses Enter — the keyboard-only activation. */
async function pressEnterOn(page: Page, locator: ReturnType<Page['getByRole']>) {
  await locator.focus()
  await page.keyboard.press('Enter')
}

/**
 * Data prep (clicks allowed — a different actor): the state-agnostic Marina
 * T1 activation, mirroring cashier.operations' helper. An Inactive table is
 * HIDDEN from the public entry list, so the keyboard journey could never
 * see it without this. Caller holds the Marina T1 lock.
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
  }
  // The deterministic oracle for BOTH paths (was active / just activated).
  await expect(page.getByRole('button', { name: 'Deactivate T1' })).toBeVisible()
  await page.close()
}

test('the customer orders keyboard-only: entry → menu → cart → submitted round (FR-02)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  // Marina T1 — the established real-round fixture, under its cross-file
  // lock (the cashier/kitchen specs share it). The keyboard join (re)opens
  // the session exactly like the entry flow does for any guest.
  await withMarinaT1Lock(async () => {
    await ensureMarinaT1Active(browser)
    await page.goto('/r/blue-olive')
    await withEntryLock(async () => {
      await page.getByLabel('Branch').selectOption({ label: 'Marina' })
      await page.getByLabel('Table').selectOption({ label: 'T1' })
      await page.getByLabel('Your name').fill('Kb Journey Guest')
      await page.getByLabel('Phone number').fill('+15557477001')
      // The join: focus + Enter — never a click from here on.
      await pressEnterOn(page, page.getByRole('button', { name: 'Join the table' }))
    })
    await expect(page).toHaveURL(/\/r\/blue-olive\/menu$/)

    // Add to cart by keyboard: type the quantity, Enter on the item's add.
    const kebab = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await kebab.getByRole('spinbutton').fill('1')
    await pressEnterOn(page, kebab.getByRole('button', { name: 'Add to cart' }))
    await expect(page.getByText('Hummus added to your cart.')).toBeVisible()
    const cart = page.getByRole('region', { name: 'Cart' })
    await expect(cart.getByText('Hummus × 1')).toBeVisible()

    // Submit by keyboard: the polite success status announces the ticket.
    await pressEnterOn(page, page.getByRole('button', { name: 'Send order to the kitchen' }))
    await expect(page.getByRole('status')).toContainText(
      'Your order is in — the kitchen has ticket',
    )

    // Restore the seeded state before releasing the lock: the fixture is
    // Inactive by design (realtime's cycle deactivates at its end for the
    // same reason), and management.surfaces asserts the Inactive read under
    // this very lock — leaving T1 Active here makes every later reader
    // order-dependent (the batch-order flake this repair removes).
    const restore = await browser.newPage()
    await signInAs(restore, seedCredentials.alice)
    await restore.goto(`/dashboard/branches/${branchIds.marina}`)
    const deactivate = restore.getByRole('button', { name: 'Deactivate T1' })
    await expect(deactivate).toBeVisible()
    await deactivate.click()
    await expect(restore.getByRole('button', { name: 'Reactivate T1' })).toBeVisible()
    await restore.close()
  })
})

test('the staff mobile drawer is keyboard-complete: open, contained, Escape, restore (FR-04/FR-09)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page, seedCredentials.carla)

  const opener = page.getByRole('button', { name: 'Open navigation menu' })
  await pressEnterOn(page, opener)
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  // Focus moved INTO the drawer on open (the Drawer primitive's contract).
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
    .toBe(true)

  // Tab cycling stays CONTAINED in the drawer (the trap).
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
    .toBe(true)

  // Escape closes; focus restores to the opener (not lost to <body>).
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('the session close is keyboard-complete: dialog containment, Escape, restore, confirm (FR-02/FR-04)', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000)
  // T2 Downtown under its lock: the guest join is data prep (a different
  // actor); the JOURNEY — bob closing the session — is keyboard-only.
  await withT2Lock(async () => {
    const guest = await browser.newPage()
    await withEntryLock(async () => {
      await guest.goto('/r/blue-olive')
      await guest.getByLabel('Branch').selectOption({ label: 'Downtown' })
      await guest.getByLabel('Table').selectOption({ label: 'T2' })
      await guest.getByLabel('Your name').fill('Kb Close Guest')
      await guest.getByLabel('Phone number').fill('+15557477002')
      await guest.getByRole('button', { name: 'Join the table' }).click()
    })
    await expect(guest).toHaveURL(/\/r\/blue-olive\/menu$/)
    await guest.close()

    await signInAs(page, seedCredentials.bob)
    await page.goto('/dashboard/sessions')
    await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
    const row = page.getByRole('listitem').filter({ hasText: 'T2' }).first()
    const closeTrigger = row.getByRole('button', { name: 'Close session for T2' })

    // Open the confirm dialog by keyboard; focus moves inside it.
    await pressEnterOn(page, closeTrigger)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('dialog') !== null))
      .toBe(true)

    // Escape cancels; the trigger regains focus (native dialog restore).
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(closeTrigger).toBeFocused()

    // Reopen and confirm — keyboard all the way to the announced closure.
    await pressEnterOn(page, closeTrigger)
    await expect(page.getByRole('dialog')).toBeVisible()
    await pressEnterOn(page, page.getByRole('button', { name: 'Confirm closing T2' }))
    await expect(page.getByRole('status')).toContainText(/T2.s session was closed/)
  })
})

test('the super-admin onboarding is keyboard-complete: form, outcome, credential (FR-02)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')

  const stamp = Date.now()
  const name = `Kb Onboard ${stamp}`
  await page.getByLabel('Restaurant name').fill(name)
  await page.getByLabel('Public identifier').fill(`kb${stamp}`)
  await page.getByLabel('First owner email').fill(`kb-owner-${stamp}@restopilot.dev`)
  await page.getByLabel('First owner display name').fill('Kb Owner')
  await pressEnterOn(page, page.getByRole('button', { name: 'Onboard restaurant' }))

  // The inline outcome AND the distinct toast (spec 034 D2), announced
  // without stealing focus from the (re-enabled) submit control.
  await expect(page.getByRole('status').filter({ hasText: 'Onboarded' })).toBeVisible()
  await expect(
    page.getByText(`"${name}" is onboarded — the overview below now lists the new tenant.`),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Onboard restaurant' })).toBeEnabled()

  // The one-time credential block: the copy affordance speaks its outcome
  // (clipboard grant varies by context — both outcomes are honest states).
  await pressEnterOn(page, page.getByRole('button', { name: 'Copy credential' }))
  await expect(
    page.getByRole('status').filter({ hasText: /Copied\.|Copying is unavailable/ }),
  ).toBeVisible()
})
