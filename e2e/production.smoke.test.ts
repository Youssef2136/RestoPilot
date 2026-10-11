import { expect, test } from '@playwright/test'
import { withEntryLock } from './helpers/entryLock'
import { signInAs } from './helpers/signInAs'
import { ConsoleCollector } from './helpers/console'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * specs/040 T007 — the BUILT ARTIFACT's smoke record (US2/US4): the same
 * app served by `vite preview` (dist/, no dev server, no HMR) proves the
 * release states the master plan §Phase20 names:
 *   the five deep-link classes (FR-05): /r/:slug, /r/:slug/menu, /signin,
 *     /dashboard/*, /admin/*;
 *   the production-build state matrix: cold load, deep-link load, the
 *     error boundary's recovery view (the demo-slug entry refusal in the
 *     built artifact), the offline banner, a refused mutation verbatim;
 *   one REAL ordering round with realtime movement driven by a staff page
 *     (the platform's core loop works in the built artifact);
 *   console cleanliness expected-vs-unexpected (F-G14) on the built app.
 *
 * Runs standalone (`npx playwright test e2e/production.smoke.test.ts`)
 * while the preview server answers on the config's baseURL port; the
 * db:reset protocol holds (a fresh seed before the window). The dev-only
 * Vite noise filter in the console helper cannot fire here — the built
 * artifact has none, and its presence would be a finding, not a filter.
 */
const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

test('deep links load in the built artifact; the five route classes open cold (FR-05)', async ({
  page,
}) => {
  const console_ = new ConsoleCollector(page)
  console_.attach()

  // /signin — the built artifact's form opens cold.
  await page.goto('/signin')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  // /r/:slug — the public entry opens cold (fresh browser posture); the
  // Table combobox populates once a Branch is chosen (the form's
  // progressive disclosure — the built app honors it).
  await page.goto(`/r/${SLUG}`)
  await expect(page.getByLabel('Branch')).toBeVisible()
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await expect(page.getByLabel('Table')).toBeVisible()

  // /r/:slug/menu signed-out — the entry gate renders in the built app.
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await page.getByLabel('Table').selectOption({ label: 'T3' })
    await page.getByLabel('Your name').fill('Release Session')
    await page.getByLabel('Phone number').fill('+15559600002')
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()

  // The FRESH-BROWSER posture: clear the session (the customer shell's
  // storage) and hit the signed-out gate.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (/token|session/i.test(key)) localStorage.removeItem(key)
    sessionStorage.clear()
  })
  await page.goto(`/r/${SLUG}/menu`)
  await expect(page).toHaveURL(new RegExp(`/${SLUG}$`))
  await expect(page.getByRole('heading', { name: 'Blue Olive', level: 1 })).toBeVisible()

  // /dashboard/* signed-out — the honest redirect to /signin.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/signin$/)

  // /admin/* signed-out — the platform console's redirect posture.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/signin$/)

  console_.assertClean('deep-link cold loads (built artifact, FR-05)')
})

test('the demo-slug entry refusal is the built error-boundary posture; offline banner lifecycle; a refused mutation renders verbatim (state matrix)', async ({
  page,
  browser,
}) => {
  const console_ = new ConsoleCollector(page)
  console_.attach()

  // The error/refusal state (no dev server to mask it): the entry read for
  // a slug the seed does not carry renders the honest refusal view.
  await page.goto('/r/demo-restaurant-that-is-not-seeded')
  await expect(page.getByText(/restaurant not found/i).first()).toBeVisible()

  // Offline banner lifecycle in the built artifact (the cashier leg — the
  // journey's offline posture on a staff surface the menu poll doesn't own).
  const offline = await browser.newContext()
  const staffOffline = await offline.newPage()
  await signInAs(staffOffline, seedCredentials.carla)
  await staffOffline.goto('/dashboard/rounds')
  await expect(staffOffline.getByRole('heading', { name: /rounds/i })).toBeVisible()
  await staffOffline.context().setOffline(true)
  const banner = staffOffline.getByRole('status').filter({ hasText: "You're offline" })
  await expect(banner).toBeVisible({ timeout: 10_000 })
  await staffOffline.context().setOffline(false)
  await expect(banner).toBeHidden({ timeout: 10_000 })
  await offline.close()

  console_.assertClean('refusal + offline states (built artifact)')
})

test('a REAL round flows: guest orders, staff moves it live, the refusal injects verbatim, then closes honestly (the built artifact proves the loop)', async ({
  browser,
}) => {
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const staff = await browser.newContext()
  const guestPage = await guest.newPage()
  const staffPage = await staff.newPage()
  const guestConsole = new ConsoleCollector(guestPage)
  guestConsole.attach()

  // The real round: entry → menu → submit (the built app's core loop).
  await withEntryLock(async () => {
    await guestPage.goto(`/r/${SLUG}`)
    await guestPage.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await guestPage.getByLabel('Table').selectOption({ label: 'T3' })
    await guestPage.getByLabel('Your name').fill('Production Smoke')
    await guestPage.getByLabel('Phone number').fill('+15559600001')
    await guestPage.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(guestPage).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await guestPage.getByRole('button', { name: 'Add to cart' }).first().click()
  await guestPage.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(guestPage.getByText(/your order is in/i)).toBeVisible()
  const history = guestPage.getByLabel('Your rounds')
  const roundLine = history.getByRole('listitem').filter({ hasText: /Round \d+ —/ })
  await expect(roundLine.first()).toBeVisible({ timeout: 20_000 })

  // Staff moves it — the realtime loop in the built artifact: carla's
  // rounds board shows the card and accepts.
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/rounds')
  const card = staffPage.locator('[data-round-state]').first()
  await expect(card).toBeVisible({ timeout: 15_000 })

  // The refused mutation, verbatim: the documented accept_round injection
  // at the CONFIRM click; the card's refusal renders the server message.
  await staffPage.route('**/rest/v1/rpc/accept_round', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"message": "production-smoke injected refusal", "code": "P0001"}',
    }),
  )
  await card.getByRole('button', { name: 'Accept round' }).click()
  if (await staffPage.getByRole('button', { name: /confirm/i }).count()) {
    await staffPage
      .getByRole('button', { name: /confirm/i })
      .first()
      .click()
  }
  const refusal = staffPage.locator('[data-refusal]').first()
  await expect(refusal).toBeVisible({ timeout: 10_000 })
  await expect(refusal).toContainText(/production-smoke injected refusal/i)
  await staffPage.unroute('**/rest/v1/rpc/accept_round')

  // The user's explicit retry lands the accept (honesty, not resilience
  // theater): the same control, confirmed again — the server decides.
  await card.getByRole('button', { name: 'Accept round' }).click()
  await expect(staffPage.locator('[data-round-state="accepted"]').first()).toBeVisible({
    timeout: 15_000,
  })
  await staffPage.close()
  await guest.close()
  await staff.close()

  guestConsole.assertClean('the real round loop (built artifact)')
})
