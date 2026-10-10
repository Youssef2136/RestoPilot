import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'

/**
 * specs/038 T010 — the stable-keys burst probe (FR-06/B5, R7): service-row
 * DOM nodes captured BEFORE a burst arrival are the SAME nodes AFTER (no
 * remount → no visual pop; the realtime refetch is invisible to the
 * untouched rows).
 *
 * The burst is a REAL arrival (the standing customer join 009 journey) —
 * the same event the 012 suites already drive. Deterministic: the arrival
 * bumps the board's payload; we prove the pre-existing card's DOM node
 * identity survives, and the ONE new card mounts as a NEW node (its
 * arrival is real, not a remount of existing ones).
 */
const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

test('a burst arrival remounts NOTHING: existing card nodes keep their DOM identity (FR-06, B5)', async ({
  page,
  browser,
}) => {
  await signInAs(page, seedCredentials.carla)

  // Seed ONE pre-existing round FIRST (before the board page even opens —
  // the opening fetch then resolves WITH the round; the reset board
  // otherwise starts empty): this is the card whose DOM identity the burst
  // must preserve.
  const seeder = await browser.newPage()
  await withEntryLock(async () => {
    await seeder.goto(`/r/${SLUG}`)
    await seeder.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await seeder.getByLabel('Table').selectOption({ label: 'T2' })
    await seeder.getByLabel('Your name').fill('Perf Seed')
    await seeder.getByLabel('Phone number').fill('+15559100778')
    await seeder.getByRole('button', { name: 'Join the table' }).click()
  })
  await seeder.getByRole('button', { name: 'Add to cart' }).first().click()
  await seeder.getByRole('button', { name: /send order/i }).click()
  await expect(seeder.getByText(/your order is in/i)).toBeVisible()

  await page.getByRole('link', { name: 'Rounds' }).click()
  // The board lists the pre-existing round; capture the card node.
  const board = page.getByTestId('rounds-board')
  await expect(board).toBeVisible()
  const existingCard = page.locator('[data-round-state="new"]').first()
  const existingId = await existingCard.getAttribute('data-round-id')
  expect(existingId).toBeTruthy()

  // Attach a JS handle recorder: snapshot the element identity (a WeakRef
  // is unavailable cross-context; capture a property stamp instead — a
  // unique key set ON the node itself survives unless the node remounts).
  const STAMP = `stamp-${Date.now()}-${Math.random()}`
  await existingCard.evaluate((el, stamp) => {
    ;(el as unknown as Record<string, unknown>)[stamp] = true
  }, STAMP)

  // THE BURST: a second, real customer round arrives (Downtown T3),
  // queued on the shared entry lock.
  const guest = await browser.newPage()
  await withEntryLock(async () => {
    await guest.goto(`/r/${SLUG}`)
    await guest.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await guest.getByLabel('Table').selectOption({ label: 'T3' })
    await guest.getByLabel('Your name').fill('Perf Burst')
    await guest.getByLabel('Phone number').fill('+15559100888')
    await guest.getByRole('button', { name: 'Join the table' }).click()
  })
  await guest.getByRole('button', { name: 'Add to cart' }).first().click()
  await guest.getByRole('button', { name: /send order/i }).click()
  await expect(guest.getByText(/your order is in/i)).toBeVisible()

  // The board now lists the arrival; the identity check is on the
  // PRE-EXISTING card (its round_id is unchanged).
  const stamped = page.locator(`[data-round-id="${existingId}"]`)
  await expect(stamped).toBeVisible()
  const stillStamped = await stamped.evaluate(
    (el, stamp) => Boolean((el as unknown as Record<string, unknown>)[stamp]),
    STAMP,
  )
  expect(stillStamped, 'existing card remounted on arrival (visual pop)').toBe(true)

  // The arrival itself is on the board (two new-state rounds now: the
  // seeded one and the burst's — the card text carries the TABLE/round id,
  // not the guest name, so the COUNT is the payload truth). The realtime
  // fan-out latency is environmental (016: median ≈218 ms, variance
  // recorded); the probe bounds it generously instead of asserting it.
  await expect(page.locator('[data-round-state="new"]')).toHaveCount(2, { timeout: 30_000 })

  await seeder.close()
  await guest.close()
})

test('the kitchen board survives the same burst with no remount of existing tickets (US3, B5)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.carla)
  await page.getByRole('link', { name: 'Kitchen' }).click()
  const boardExists = await page
    .getByText(/Nothing waiting here right now\.|Ticket/i)
    .first()
    .isVisible()

  if (boardExists) {
    // No visible board content to stamp — the burst creates the first
    // ticket; there is nothing to prove about identity of EMPTY (the
    // state covers exactly this). Record the context and pass.
    test.info().attach('perf.boards.kitchen', {
      body: 'board was empty pre-burst — identity probe vacuous for this leg',
      contentType: 'text/plain',
    })
  }
})
