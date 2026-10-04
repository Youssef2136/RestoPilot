import { expect, test, type Browser, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { withEntryLock } from './helpers/entryLock'
import { withSubscriptionLock } from './helpers/subscriptionLock'
import { signInAs } from './helpers/signInAs'

/**
 * Live-awareness E2E (specs/032; Master Plan §Frontend Phase 12) — the two
 * gaps the existing suites did not cover:
 *
 * 1. the nearing_expiration banner state + the honest owner-facing detail
 *    panel (FR-05, D5/D7) — driven through the platform console exactly
 *    like platform.surfaces' expired journey, under the cross-file
 *    subscription lock, restored to active before the lock releases.
 * 2. the cue's no-payload discipline (FR-02, F1) — the announcement is the
 *    fixed line plus its two affordances and NOTHING else (no customer
 *    name, no item, no money, no ids) — and the 390px pass with the cue
 *    visible.
 *
 * Sign-in budget (§12.5): four (platformAdmin ×2, alice, carla).
 */

const SLUG = 'blue-olive'
const iso = (d: Date) => d.toISOString().slice(0, 10)

// Serial: both tests exercise slow console/auth flows on the shared cloud;
// racing their sign-ins only adds flake (the platform.surfaces precedent).
test.describe.configure({ mode: 'serial' })

/** The cue's join ACK must be observed BEFORE the write (realtime's rule). */
function waitForCueSubscribed(page: Page): Promise<void> {
  // The ACK is the deterministic signal, but a missed frame must not wedge
  // the test: after 15 s the channel is assumed joined (the SUBSCRIBED
  // refetch reconciles either way — the binding's own posture).
  const grace = new Promise<void>((resolve) => setTimeout(resolve, 15_000))
  const ack = new Promise<void>((resolve) => {
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
  return Promise.race([ack, grace])
}

/** One real customer submission through the public surface (entry-locked). */
async function submitCustomerRound(
  browser: Browser,
  branchLabel: string,
  tableLabel: string,
  itemName: string,
  customerName: string,
): Promise<Page> {
  const page = await browser.newPage()
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: branchLabel })
    await page.getByLabel('Table').selectOption({ label: tableLabel })
    await page.getByLabel('Your name').fill(customerName)
    await page.getByLabel('Phone number').fill('+15550993')
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()
  await page
    .locator('li', { hasText: itemName })
    .first()
    .getByRole('button', { name: 'Add to cart' })
    .click()
  await page
    .getByRole('region', { name: 'Cart' })
    .getByRole('button', { name: /send order/i })
    .click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)
  return page
}

test('a nearing-expiration subscription shows the banner state and the honest detail (FR-05, D7)', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await withSubscriptionLock(async () => {
    // Drive the tenant into nearing_expiration: after a reset the row is
    // never_activated, so the row's action is 'Activate' — one Save with
    // start=today, end=+3 days lands the state directly (the console only
    // offers 'Change dates' once dates exist).
    await signInAs(page, seedCredentials.platformAdmin)
    await page.goto('/admin/platform')
    await page.getByRole('button', { name: 'Activate' }).first().click()
    const today = new Date()
    const in3 = new Date()
    in3.setUTCDate(in3.getUTCDate() + 3)
    await page.getByLabel('Start date').fill(iso(today))
    await page.getByLabel('End date').fill(iso(in3))
    await page.getByRole('button', { name: 'Save dates' }).click()
    // The console's own state column proves the write landed (a silent
    // mutation failure would leave the form open and the row untouched).
    await expect(page.getByTestId('platform-overview')).toContainText('Nearing expiration', {
      timeout: 20_000,
    })

    // Alice (owner) sees the nearing banner and opens the honest detail.
    await signInAs(page, seedCredentials.alice)
    const banner = page.getByTestId('subscription-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAttribute('data-banner-state', 'nearing_expiration')
    await banner.getByRole('button', { name: 'What does this mean?' }).click()
    const detail = page.getByTestId('subscription-detail')
    await expect(detail).toContainText('Nearing expiration')
    await expect(detail).toContainText(
      'Ordering is not affected by expiry — customers keep ordering.',
    )
    await expect(detail).toContainText('the platform owner acts here, not your restaurant')
    // The disclosure collapses — the body text is gone, the affordance stays.
    await banner.getByRole('button', { name: 'What does this mean?' }).click()
    await expect(detail).not.toContainText('Nearing expiration')

    // Restore the active state so downstream suites see the neutral tenant.
    await signInAs(page, seedCredentials.platformAdmin)
    await page.goto('/admin/platform')
    await page.getByRole('button', { name: 'Change dates' }).first().click()
    const in30 = new Date()
    in30.setUTCDate(in30.getUTCDate() + 30)
    await page.getByLabel('Start date').fill(iso(today))
    await page.getByLabel('End date').fill(iso(in30))
    await page.getByRole('button', { name: 'Save dates' }).click()
    await expect(page.getByTestId('platform-overview')).toContainText('Active')
  })
})

test('the cue announces arrivals without payload data and holds 390px (FR-02, F1)', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  const cueSubscribed = waitForCueSubscribed(page)
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard')
  await cueSubscribed

  const customer = await submitCustomerRound(
    browser,
    'Downtown',
    'T3',
    'Hummus',
    'E2E Payload Guest',
  )

  // The cue is EXACTLY the fixed line plus its two affordances — the event's
  // payload fields (the customer's name, the item, money, ids) never appear.
  const cue = page.locator('[data-live-cue]')
  await expect(cue).toBeVisible({ timeout: 15_000 })
  // EXACTLY the fixed line plus its two affordances — asserted by parts so
  // the structure is pinned without whitespace-shape coupling.
  await expect(cue.getByText('A new order arrived.')).toBeVisible()
  await expect(cue.getByRole('link', { name: 'Show the new order' })).toBeVisible()
  await expect(cue.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await expect(cue.locator('> *')).toHaveCount(3)
  await expect(cue).not.toContainText('E2E Payload Guest')
  await expect(cue).not.toContainText('Hummus')
  await expect(cue).not.toContainText('$')

  // 390px: the cue stays in flow, never covering the primary actions, and
  // the dashboard holds without horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(cue).toBeVisible()
  await customer.close()
})
