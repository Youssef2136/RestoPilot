import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { withEntryLock } from './helpers/entryLock'

/**
 * specs/038 T006 — the throttled customer journey (FR-08a, R3).
 *
 * Profile (clarified): Slow 3G (≈1.6 Mbps / 750 Kbps / 150 ms RTT — the
 * DevTools preset) + CPU×4, applied through CDP. HARD assertions here are
 * ONLY the client-deterministic facts; every absolute cloud-DB-derived
 * timing is INFORMATIONAL (recorded into the W2 evidence file's shape via
 * the test output — the shared infrastructure's variance is acknowledged,
 * never asserted).
 *
 * Hard facts asserted:
 *  - NO duplicated network requests on the menu load (each
 *    get_session_* / menu request appears at most once).
 *  - NO staff/admin page chunks requested on the customer route
 *    (the D2 split boundary at runtime, complementing the manifest unit).
 *  - Cart-add renders its local state WITHOUT a network round-trip
 *    (the local-first cart, B4): the round line count does not increment
 *    the network log at click time and the cart region updates locally.
 */
const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

async function throttle(page: Page): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  return session
}

test('the throttled journey: menu loads once, no staff chunks, cart-add is local (FR-08a/B4)', async ({
  page,
}, testInfo) => {
  const requests: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('/assets/') || url.includes('supabase.co')) {
      requests.push(`${req.method()} ${url}`)
    }
  })

  // The join is the real customer path (the entry lock guards the burst).
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await page.getByLabel('Table').selectOption({ label: 'T3' })
    await page.getByLabel('Your name').fill('Perf Journey')
    await page.getByLabel('Phone number').fill('+15559100777')
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))

  // Throttle AFTER the join; the MENU segment is the measurement subject.
  const cdp = await throttle(page)

  // Measurement window: a RELOAD of the menu route (fresh mount, the
  // session token still in localStorage) — the deduped-load fact holds for
  // THIS window only (the multi-step join necessarily refetches the public
  // surface per navigation step;DEDUP is the menu-load discipline).
  requests.length = 0
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()

  // ── HARD: no duplicated data requests on the menu load.
  const rpcCalls = requests.filter((r) => r.includes('rest/v1/rpc'))
  const dupes = rpcCalls.filter((r, i) => rpcCalls.indexOf(r) !== i)
  expect(dupes, `duplicated requests: ${dupes.join(', ')}`).toEqual([])

  // ── HARD: no staff/admin page chunk fetched on the customer route.
  const staffChunks = requests.filter((r) =>
    /assets\/(DashboardPage|CashierRoundsPage|KitchenDashboardPage|StaffListPage|AuditLogPage|ReportsPage|MenuPage|TaxPage|AdminPage)/.test(
      r,
    ),
  )
  expect(
    staffChunks,
    `staff chunks leaked to the customer route: ${staffChunks.join(', ')}`,
  ).toEqual([])

  // ── HARD (B4): cart-add is local — the cart updates and the request log
  // gains NO write around the click window. (The window baseline is taken
  // after the menu-load assertions above.)
  const cartRequestsBefore = requests.length
  await page
    .locator('li', { hasText: 'Hummus' })
    .first()
    .getByRole('button', { name: 'Add to cart' })
  const addStart = Date.now()
  const firstCard = page.locator('li', { hasText: 'Hummus' }).first()
  await firstCard.getByRole('button', { name: 'Add to cart' }).click()
  const cart = page.getByRole('region', { name: 'Cart' })
  await expect(cart.getByText('Hummus × 1')).toBeVisible()
  const localRenderMs = Date.now() - addStart
  const writeRequests = requests
    .slice(cartRequestsBefore)
    .filter((r) => r.includes('rest/v1/rpc') && !r.includes('get_'))
  expect(writeRequests, 'cart-add must not issue writes').toEqual([])

  // The client-deterministic mark: this measures the BROWSER's own work to
  // update the cart region (CPU-throttled). Asserted hard at a generous
  // bound (one interaction frame is asserted by "local, no write"; this
  // bound only catches pathological re-render stalls, not cloud latency).
  expect(localRenderMs, 'cart-add local render (CPU×4)').toBeLessThan(1500)

  // ── INFORMATIONAL (B1 signal): the throttled menu-interactive timing is
  // recorded into the test output (the W2 evidence file references this
  // attach). Never asserted against a threshold — the shared cloud DB's
  // variance dominates it (clarified).
  const menuInteractiveMs = Date.now() - addStart - localRenderMs
  testInfo.attach('perf.customer.informational', {
    body: JSON.stringify(
      {
        profile: 'Slow 3G + CPU×4 (CDP)',
        cartAddLocalRenderMs: localRenderMs,
        menuInteractiveNoteMs: menuInteractiveMs,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })

  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await cdp.detach()
})
