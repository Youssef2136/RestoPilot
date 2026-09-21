import { expect, test, type Browser, type Page } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Realtime E2E (spec 012 T011; SC-001…SC-004): a staff surface stays open
 * while a SECOND browser context drives committed writes through the REAL
 * customer and staff surfaces — and the open dashboard reflects them
 * WITHOUT a manual refresh. The observation is purely visual: groups move,
 * cards appear, the cue renders — nothing about the transport is stubbed,
 * and no env is read in the test process (the house e2e discipline: the
 * browser carries its own VITE env; writes go through the UI, not RPCs).
 *
 * The file runs serially in one worker (kitchen.cashier precedent): the
 * journeys share the seeded staff context.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** Signs a seeded identity in through the /signin form. */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

/**
 * One real customer submission through the public surface from a fresh
 * browser context: enter at the branch's table, add the named item, send.
 * Resolves when the order is committed ("your order is in" rendered).
 */
async function submitCustomerRound(
  browser: Browser,
  branchLabel: string,
  tableLabel: string,
  itemName: string,
): Promise<void> {
  const page = await browser.newPage()
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: branchLabel })
  await page.getByLabel('Table').selectOption({ label: tableLabel })
  await page.getByLabel('Your name').fill('E2E Realtime Customer')
  await page.getByLabel('Phone number').fill('+15550998')
  await page.getByRole('button', { name: 'Join the table' }).click()
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
 * Resolves when the cue channel's phoenix join has been ACKed — the
 * SUBSCRIBED moment. The cue is deliberately event-derived with NO
 * recovery read (contracts/realtime-client.md §2): a round committed
 * before SUBSCRIBED is invisible to it, so the test registers this
 * listener before the dashboard mounts and waits for the ACK before
 * driving the write (the data surfaces heal the early-write case via
 * their §1.4 refetch-on-subscribe instead).
 */
function waitForCueSubscribed(page: Page): Promise<void> {
  return new Promise((resolve) => {
    const onWebSocket = (ws: import('@playwright/test').WebSocket) => {
      const onFrame = (frame: { payload: string | Buffer }) => {
        const text = String(frame.payload)
        if (
          text.includes('realtime:cue:rounds') &&
          text.includes('phx_reply') &&
          text.includes('"status":"ok"')
        ) {
          cleanup()
          resolve()
        }
      }
      const cleanup = () => {
        page.off('websocket', onWebSocket)
        ws.off('framereceived', onFrame)
      }
      ws.on('framereceived', onFrame)
    }
    page.on('websocket', onWebSocket)
  })
}

test('a customer submission appears in the open cashier dashboard without manual refresh (SC-001)', async ({
  page,
  browser,
}) => {
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')

  // The dashboard is open and rendering. Submit a REAL round from "another
  // device" (a second browser context through the public surface) and watch
  // the card arrive without any manual refresh.
  const roundsBefore = await page.locator('article[data-round-id]').count()
  await submitCustomerRound(browser, 'Downtown', 'T3', 'Hummus')

  await expect
    .poll(async () => page.locator('article[data-round-id]').count(), {
      timeout: 15_000,
      message: 'the new round card should arrive via realtime invalidation',
    })
    .toBeGreaterThan(roundsBefore)
})

test('a round advanced in a second staff browser moves the card groups live here (SC-001)', async ({
  page,
  browser,
}) => {
  // A fresh customer round exists (the fixture starts round-less and this
  // suite is serial, so the first incoming card is the one being advanced).
  await submitCustomerRound(browser, 'Downtown', 'T3', 'Hummus')

  // carla keeps her dashboard open.
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')
  await expect(page.locator('[data-round-state="new"]').first()).toBeVisible()

  // bob (Downtown branch manager) advances THE SAME round in HIS browser.
  const bob = await browser.newPage()
  await signInAs(bob, seedCredentials.bob)
  await bob.goto('/dashboard/rounds')
  const bobIncoming = bob.locator('[data-round-state="new"]').first()
  await expect(bobIncoming).toBeVisible()

  // Identify the round bob accepts by its displayed id fragment, then watch
  // exactly that card change state in carla's OPEN view — she acts on
  // nothing; the update arrives through her subscription.
  const cardText = await bobIncoming.innerText()
  const fragment = cardText.match(/round ([0-9a-f]{8})/)?.[1]
  expect(fragment, 'the card renders its id fragment').toBeTruthy()

  await bobIncoming.getByRole('button', { name: 'Accept round' }).click()
  await expect(bob.locator('[data-round-state="accepted"]').first()).toBeVisible()
  await bob.close()

  const carlaCard = page.locator('article[data-round-id]').filter({ hasText: fragment! })
  await expect(
    carlaCard,
    "carla sees bob's advance live, without touching anything",
  ).toHaveAttribute('data-round-state', 'accepted', { timeout: 15_000 })
})

test('the kitchen queue updates live and stays money-free (SC-002)', async ({ page, browser }) => {
  // Marina T1 is the seeded INACTIVE fixture — the owner activates it through
  // the management surface (the browser path; the RPC is not reachable from
  // a test browser), and deactivates it again at the end so the fixture
  // stays deterministic for management.surfaces.
  const alice = await browser.newPage()
  await signInAs(alice, seedCredentials.alice)
  await alice.goto(`/dashboard/branches/${branchIds.marina}`)
  const marinaRow = alice.getByRole('listitem').filter({ hasText: 'T1' })
  await expect(marinaRow).toContainText('Inactive')
  await alice.getByRole('button', { name: 'Reactivate T1' }).click()
  await expect(marinaRow).toContainText('Active')
  await alice.close()

  // dan keeps the kitchen queue open.
  await signInAs(page, seedCredentials.dan)
  await page.goto('/dashboard/kitchen')
  await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible()

  const ticketsBefore = await page.locator('article[data-ticket-id]').count()
  await submitCustomerRound(browser, 'Marina', 'T1', 'Hummus')

  await expect
    .poll(async () => page.locator('article[data-ticket-id]').count(), {
      timeout: 15_000,
      message: 'the new ticket should arrive live',
    })
    .toBeGreaterThan(ticketsBefore)

  // SC-002's money-free assertion over the LIVE queue.
  const pageText = await page.locator('section').innerText()
  expect(pageText).not.toMatch(/subtotal|tax|total|price/i)

  // Restore the fixture: Marina T1 back to its seeded inactive state.
  const aliceAgain = await browser.newPage()
  await signInAs(aliceAgain, seedCredentials.alice)
  await aliceAgain.goto(`/dashboard/branches/${branchIds.marina}`)
  const marinaRowAgain = aliceAgain.getByRole('listitem').filter({ hasText: 'T1' })
  await aliceAgain.getByRole('button', { name: 'Deactivate T1' }).click()
  await expect(marinaRowAgain).toContainText('Inactive')
  await aliceAgain.close()
})

test('the live cue renders on a new round and the reload path reconciles (SC-004, US4)', async ({
  page,
  browser,
}) => {
  // Register the socket listener BEFORE the dashboard mounts, so the join
  // ACK cannot slip past unobserved.
  const cueSubscribed = waitForCueSubscribed(page)
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard')
  await cueSubscribed

  // A real customer round from a second context — committed AFTER the cue
  // channel subscribed, so the event-derived cue must catch it.
  await submitCustomerRound(browser, 'Downtown', 'T3', 'Hummus')
  const cue = page.locator('[data-live-cue]')
  await expect(cue).toBeVisible({ timeout: 15_000 })
  await expect(cue).toContainText('A new order arrived')

  // The recovery proof in its browser shape: a reload renders the
  // authoritative state through the normal load path.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Staff Dashboard' })).toBeVisible()
})
