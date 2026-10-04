import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { signInAs } from './helpers/signInAs'

/**
 * Channel operations E2E (specs/031; Master Plan §Frontend Phase 11) — the
 * three channels legible everywhere they matter:
 *
 * 1. the delivery journey: cutoff pre-emption (disabled add affordance +
 *    aria-describedby notice + polite announcement) BEFORE the attempt, the
 *    server's verbatim refusal with the cart preserved (FR-02/FR-06), the
 *    one-tap dispatch, the two-step completion (D3), the customer timeline
 *    (FR-07), the kitchen's channel blindness asserted over a LIVE delivery
 *    round (D6), and the 390 px pass with axe.
 * 2. the channel filter (FR-05, D2): narrows honestly, restores exactly.
 * 3. the takeaway leg: cutoff on `ready`, the pickup announcement (D4).
 *
 * Every test creates its OWN channel session (unique address/phone per run),
 * targets staff cards by `data-round-state` + the unique address, and needs
 * no shared fixture locks (no table joins — the channel entry has no table).
 */

const SLUG = 'blue-olive'

test('the delivery journey: cutoff pre-emption, verbatim refusal, dispatch, completion, timeline, kitchen blindness, 390px', async ({
  page,
}) => {
  test.setTimeout(240_000) // the suite's machine runs ~1.7x slow: one staff sign-in, six staff transitions, a kitchen leg, and two customer polls
  const address = `9 Channel Road ${Date.now()}` // unique per run — rerun residue

  // ── Customer: enter as delivery, submit the first round. ────────────────
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByRole('radio', { name: 'Delivery' }).check()
  await page.getByLabel('Delivery address').fill(address)
  await page.getByLabel('Your name').fill('Channel Guest')
  await page.getByLabel('Phone number').fill('+15559100001')
  await page.getByRole('button', { name: 'Start a delivery order' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))

  // The channel chip names the channel in the indicator (FR-01); the address
  // echo stays the customer's own (FR-04).
  await expect(page.locator('[data-channel-chip]')).toHaveText('Delivery')
  await expect(page.getByText(address).first()).toBeVisible()

  const addButtons = page.getByRole('button', { name: 'Add to cart' })
  await expect(addButtons.first()).toBeEnabled()

  const addHummus = async (quantity: string) => {
    const hummusSection = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await hummusSection.getByRole('spinbutton').fill(quantity)
    await hummusSection.getByRole('button', { name: 'Add to cart' }).click()
  }
  await addHummus('1')
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)

  // The refusal-proving line goes into the cart NOW — below the cutoff (the
  // D1 pre-emption will disable adds after the dispatch lands, and the
  // submit refusal is exercised with THIS preserved line, exactly like the
  // migrated FR-011 journey).
  await addHummus('2')
  await expect(page.getByRole('region', { name: 'Cart' }).getByText('Hummus × 2')).toBeVisible()

  // ── Staff (cashier): accept → prepare → ready → dispatch (one tap). ─────
  // A dedicated staff context; it is CLOSED before the customer's poll
  // assertions (react-query pauses a backgrounded tab's refetch interval,
  // and the customer's 10 s poll IS the cutoff's client knowledge — D1).
  const staff = await page.context().browser()!.newContext()
  const staffPage = await staff.newPage()
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/rounds')

  // The channel filter defaults to All channels — the full board (D2).
  await expect(staffPage.getByTestId('channel-filter')).toContainText('All channels')

  const cardIn = (state: string) =>
    staffPage
      .locator(`article[data-round-state="${state}"]`)
      .filter({ hasText: 'Delivery' })
      .filter({ hasText: address })
      .first()

  const card = cardIn('new')
  await expect(card).toBeVisible()
  // The card carries the ONE channel chip (FR-01) and the contract-permitted
  // address line (FR-04 — staff reads may render it).
  await expect(card.locator('[data-channel-chip]')).toHaveText('Delivery')
  await expect(card.getByText(`Deliver to: ${address}`)).toBeVisible()

  await card.getByRole('button', { name: 'Accept round' }).click()
  await expect(cardIn('accepted').getByRole('button', { name: 'Start preparation' })).toBeVisible()

  // ── Kitchen blindness over the LIVE delivery round (D6/FR-04): the board
  // shows the ticket with the channel-neutral head and NEVER the address or
  // any delivery logistics. The blindness assertions are count-of-zero over
  // the address substrings — they hold regardless of which tickets share
  // the board; 'Counter order' is the channel-neutral head every no-table
  // ticket carries.
  await staffPage.goto('/dashboard/kitchen')
  await expect(staffPage.locator('article[data-ticket-id]').first()).toBeVisible()
  await expect(staffPage.getByText('Counter order').first()).toBeVisible()
  await expect(staffPage.getByText(address)).toHaveCount(0)
  await expect(staffPage.getByText('Deliver to')).toHaveCount(0)

  await staffPage.goto('/dashboard/rounds')
  await cardIn('accepted').getByRole('button', { name: 'Start preparation' }).click()
  await expect(cardIn('preparing').getByRole('button', { name: 'Mark ready' })).toBeVisible()
  await cardIn('preparing').getByRole('button', { name: 'Mark ready' }).click()
  await expect(cardIn('ready').getByRole('button', { name: 'Send out for delivery' })).toBeVisible()
  await cardIn('ready').getByRole('button', { name: 'Send out for delivery' }).click()
  await expect(
    cardIn('out_for_delivery').getByRole('button', { name: 'Mark completed' }),
  ).toBeVisible()
  // ── Customer, after the poll: the cutoff pre-emption (FR-02, D1). ───────
  // The staff page goes away so the customer tab is the front tab again
  // (react-query pauses a backgrounded tab's refetch interval), and the
  // history's DESIGNED refresh affordance (FR-09) forces the fetch — the
  // poll's resume timing after background throttling is not deterministic,
  // the refresh click is.
  await staff.close()
  await page.bringToFront()
  await page
    .getByRole('region', { name: 'Your rounds' })
    .getByRole('button', { name: 'Refresh' })
    .click()
  await expect(addButtons.first()).toBeDisabled({ timeout: 30_000 })
  // The disabled affordance explains itself through the linked notice, and
  // the crossing is announced politely (never role="status" — the page's
  // single status region stays the submit-success one).
  const notice = page.locator('#cutoff-notice')
  await expect(notice).toContainText('Adding is now closed for this order.')
  await expect(
    page.getByText(
      'Adding is closed for this order — the timeline below shows exactly where it stands.',
    ),
  ).toBeVisible()
  // The cart stays alive (D1): the pre-cutoff line is still there and the
  // quantity control still works.
  const hummusSection = page.locator('li').filter({ hasText: 'Hummus' }).first()
  await expect(hummusSection.getByRole('spinbutton')).toBeEnabled()
  await expect(page.getByRole('region', { name: 'Cart' }).getByText('Hummus × 2')).toBeVisible()

  // The server remains the authority: the submit (still enabled) above the
  // cutoff meets the verbatim refusal and the cart is preserved (FR-06, the
  // frozen contract).
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'already on its way' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cart' }).getByText('Hummus × 2')).toBeVisible()

  // The timeline tells the delivery story (FR-07): the CURRENT milestone —
  // aria-current marks the reached step (a label alone always renders; the
  // honest-read discipline of F9).
  const history = page.getByRole('region', { name: 'Your rounds' })
  await expect(history.locator('[aria-current="step"]')).toHaveText('On its way', {
    timeout: 20_000,
  })

  // ── Staff: the two-step completion (FR-03, D3) — a FRESH staff context
  // (the earlier one was closed to return the customer tab to the front). ─
  const staff2 = await page.context().browser()!.newContext()
  const staffPage2 = await staff2.newPage()
  await signInAs(staffPage2, seedCredentials.carla)
  await staffPage2.goto('/dashboard/rounds')
  // Bind by THIS run's FULL unique address — the '9 Channel Road' prefix
  // alone also matches every stale completed card earlier reruns left on
  // the shared dev board (the recorded false pass).
  const cardFor = (state: string) =>
    staffPage2
      .locator(`article[data-round-state="${state}"]`)
      .filter({ hasText: 'Delivery' })
      .filter({ hasText: address })
      .first()
  await cardFor('out_for_delivery').getByRole('button', { name: 'Mark completed' }).click()
  const dialog = staffPage2.getByRole('dialog')
  await expect(dialog).toContainText('closes it for good')
  await expect(dialog.getByRole('button', { name: 'Complete the delivery' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Not yet' })).toBeVisible()
  // The terminal transition is trusted only once the server has answered —
  // closing the context mid-flight cancels the RPC (the recorded lesson).
  const completionSettled = staffPage2.waitForResponse((resp) =>
    resp.url().includes('/rpc/mark_completed'),
  )
  await dialog.getByRole('button', { name: 'Complete the delivery' }).click()
  expect((await completionSettled).status()).toBe(200)
  await expect(cardFor('completed')).toBeVisible()
  await staff2.close()

  // The customer's timeline reaches 'Delivered' after the refresh.
  await page.bringToFront()
  await page
    .getByRole('region', { name: 'Your rounds' })
    .getByRole('button', { name: 'Refresh' })
    .click()
  await expect(history.locator('[aria-current="step"]')).toHaveText('Delivered', {
    timeout: 30_000,
  })

  // ── axe floor at the DEFAULT viewport (the committed floor's discipline —
  // the closed state included); then the 390 px overflow-only pass. The
  // first 390 px axe scan of this route exposed pre-existing target-size
  // findings on the 025 cart micro-buttons (findings A3 — owning phase
  // recorded; not silently waived here).
  await expectNoNewViolations(page, { route: '/r/blue-olive/menu' })

  // ── 390 px: the closed-state surfaces do not overflow. ──────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.locator('#cutoff-notice')).toBeVisible()
})

test('the channel filter narrows the board honestly and restores it exactly (FR-05, D2)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const address = `11 Filter Lane ${Date.now()}`

  // One real delivery round so the narrowing has something to find.
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByRole('radio', { name: 'Delivery' }).check()
  await page.getByLabel('Delivery address').fill(address)
  await page.getByLabel('Your name').fill('Filter Guest')
  await page.getByLabel('Phone number').fill('+15559100002')
  await page.getByRole('button', { name: 'Start a delivery order' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await page.locator('li').filter({ hasText: 'Hummus' }).first().getByRole('spinbutton').fill('1')
  await page
    .locator('li')
    .filter({ hasText: 'Hummus' })
    .first()
    .getByRole('button', { name: 'Add to cart' })
    .click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)

  const staff = await page.context().browser()!.newContext()
  const staffPage = await staff.newPage()
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/rounds')

  const filter = staffPage.getByTestId('channel-filter')
  await expect(
    staffPage.locator('article[data-round-state="new"]').filter({ hasText: address }),
  ).toBeVisible()

  // Narrow to Delivery: the round stays. Narrow to Dine-in: THIS round is
  // gone AND no delivery ticket survives the view. The full suite runs
  // workers in parallel on the SHARED dev board — other tests' dine-in
  // rounds may legitimately be present mid-run, so emptiness is claimed
  // only for what this test owns (its own round) plus the one property
  // that holds regardless of concurrency: the Dine-in view renders no
  // 'Deliver to' card, whoever's rounds are on the board.
  await filter.getByRole('radio', { name: 'Delivery' }).check()
  await expect(
    staffPage.locator('article[data-round-state="new"]').filter({ hasText: address }),
  ).toBeVisible()
  await filter.getByRole('radio', { name: 'Dine-in' }).check()
  await expect(
    staffPage.locator('article[data-round-state]').filter({ hasText: address }),
  ).toHaveCount(0)
  await expect(staffPage.locator('article').filter({ hasText: 'Deliver to' })).toHaveCount(0)

  // Restore All channels: THIS run's round returns exactly where it was.
  await filter.getByRole('radio', { name: 'All channels' }).check()
  await expect(
    staffPage.locator('article[data-round-state="new"]').filter({ hasText: address }),
  ).toBeVisible()
  await staff.close()
})

test('the takeaway leg: cutoff on ready, pickup announcement, timeline (D4)', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByRole('radio', { name: 'Takeaway' }).check()
  await page.getByLabel('Your name').fill('Pickup Guest')
  await page.getByLabel('Phone number').fill('+15559100003')
  await page.getByRole('button', { name: 'Start a takeaway order' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.locator('[data-channel-chip]')).toHaveText('Takeaway')

  const addButtons = page.getByRole('button', { name: 'Add to cart' })
  await expect(addButtons.first()).toBeEnabled()

  await page.locator('li').filter({ hasText: 'Hummus' }).first().getByRole('spinbutton').fill('1')
  await page
    .locator('li')
    .filter({ hasText: 'Hummus' })
    .first()
    .getByRole('button', { name: 'Add to cart' })
    .click()

  // The round's id comes from the customer's own rounds read: the takeaway
  // card carries NO per-run-unique surface text (no address — that is the
  // delivery leg's discriminator), and a text-filter + .first() binding can
  // latch onto a STALE rerun-residue takeaway card stuck in an earlier state
  // (the recorded failure — the staff RPC answered 200 for the WRONG round
  // while the live round never left 'preparing'). Binding by data-round-id
  // pins every staff interaction to THIS run's round. The predicate rejects
  // an in-flight poll response that predates the submission (empty rounds).
  const roundsSettled = page.waitForResponse(async (resp) => {
    if (!resp.url().includes('/rpc/get_session_rounds')) return false
    const payload = (await resp.json()) as { rounds: Array<{ id: string }> }
    return payload.rounds.length > 0
  })
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)
  const roundsPayload = (await (await roundsSettled).json()) as {
    rounds: Array<{ id: string }>
  }
  const takeawayRoundId = roundsPayload.rounds[0].id

  // Staff: accept → prepare → ready (no dispatch exists on takeaway). Every
  // card binds by data-round-id — run-unique by construction.
  const staff = await page.context().browser()!.newContext()
  const staffPage = await staff.newPage()
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/rounds')
  const takeawayCardIn = (state: string) =>
    staffPage.locator(`article[data-round-id="${takeawayRoundId}"][data-round-state="${state}"]`)
  await expect(takeawayCardIn('new')).toBeVisible()
  await takeawayCardIn('new').getByRole('button', { name: 'Accept round' }).click()
  await expect(
    takeawayCardIn('accepted').getByRole('button', { name: 'Start preparation' }),
  ).toBeVisible()
  await takeawayCardIn('accepted').getByRole('button', { name: 'Start preparation' }).click()
  await expect(
    takeawayCardIn('preparing').getByRole('button', { name: 'Mark ready' }),
  ).toBeVisible()
  // Trust the transition only once the server has ANSWERED: closing the staff
  // context straight after the click can cancel the in-flight RPC (the
  // recorded failure trace — mark_round_ready sent, no response seen, close)
  // and then the customer's cutoff never crosses. A 2xx here is the
  // committed state the customer's fresh read below must reflect. Armed
  // BEFORE the click so the response cannot slip past the listener.
  const readySettled = staffPage.waitForResponse((resp) =>
    resp.url().includes('/rpc/mark_round_ready'),
  )
  await takeawayCardIn('preparing').getByRole('button', { name: 'Mark ready' }).click()
  expect((await readySettled).status()).toBe(200)
  // The ready-state render is verified by the CUSTOMER's refreshed read
  // below (announcement + timeline) — a staff-side ready-state binding here
  // could catch a STALE rerun-residue takeaway card already sitting in
  // 'ready' (the fresh states new/accepted/preparing are run-unique; ready
  // is not).
  await staff.close()

  // Customer: adds disabled with the takeaway reason; the pickup readiness
  // announced (D4); the timeline shows 'Ready for pickup' as current. The
  // refresh click makes the resumed fetch deterministic.
  await page.bringToFront()
  await page
    .getByRole('region', { name: 'Your rounds' })
    .getByRole('button', { name: 'Refresh' })
    .click()
  await expect(addButtons.first()).toBeDisabled({ timeout: 30_000 })
  await expect(page.locator('#cutoff-notice')).toContainText('Adding is now closed for this order.')
  await expect(page.getByText('Your pickup order is ready.')).toBeVisible({ timeout: 15_000 })
  const history = page.getByRole('region', { name: 'Your rounds' })
  await expect(history.locator('[aria-current="step"]')).toHaveText('Ready for pickup', {
    timeout: 15_000,
  })
})
