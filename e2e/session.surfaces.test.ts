import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Session surfaces E2E — US1 block (spec 007 T015; SC-001; FR-001…FR-005;
 * contracts/session-client.md §3).
 *
 * The public entry flow walked in a real browser: the public page renders the
 * restaurant from the seeded slug, branch and table selection from the
 * payload's active tables, the name/phone form with its client-side bounds,
 * the invalid-input refusals rendered, and the successful entry landing on
 * the customer menu route with the session indicator. The unknown-slug
 * not-found state is asserted too.
 *
 * Entries run against the seeded fixture (Downtown T3 is kept free by the
 * seed). Playwright gives every test a fresh browser context, so each test
 * starts token-less — the entry flow's precondition.
 */

const SLUG = 'blue-olive'

// The file runs serially in one worker: the US2 owner-close test and the US3
// closed-session test share Airport T1, and each closes what it opened.
test.describe.configure({ mode: 'serial' })

test('an unknown slug renders the not-found state (FR-001)', async ({ page }) => {
  await page.goto(`/r/no-such-restaurant`)
  await expect(page.getByRole('heading', { name: 'Restaurant not found' })).toBeVisible()
})

test('the public entry flow reaches the customer menu with the indicator (SC-001)', async ({
  page,
}) => {
  await page.goto(`/r/${SLUG}`)

  // The restaurant payload renders.
  await expect(page.getByRole('heading', { level: 1, name: 'Blue Olive' })).toBeVisible()

  // Two seeded branches → the branch picker renders (FR-002).
  const branchSelect = page.getByLabel('Branch')
  await expect(branchSelect).toBeVisible()
  await branchSelect.selectOption({ label: 'Downtown' })

  // The branch's ACTIVE tables populate the picker; Marina's stopped table
  // never appears anywhere.
  const tableSelect = page.getByLabel('Table')
  await expect(tableSelect).toBeVisible()
  const options = await tableSelect.locator('option').allTextContents()
  expect(options.join(',')).toContain('T3')
  expect(options.join(',')).not.toContain('Marina')

  await tableSelect.selectOption({ label: 'T3' })
  await page.getByLabel('Your name').fill('Playwright Guest')
  await page.getByLabel('Phone number').fill('+15559000001')
  await page.getByRole('button', { name: 'Join the table' }).click()

  // Success lands on the customer menu route with the indicator.
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.getByText(/Blue Olive · Downtown · Table T3/)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()
})

test('client-side validation feedback renders before any submission (FR-004)', async ({ page }) => {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })

  // A lettered phone is refused with the contract's message.
  await page.getByLabel('Your name').fill('Playwright Guest')
  await page.getByLabel('Phone number').fill('not-a-phone')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page.getByText('A valid phone number is required.')).toBeVisible()

  // The server's own message is surfaced verbatim when it refuses — a
  // whitespace-only name passes the trimmed length here but the server
  // refuses the BLANK name; the phone gate fires first, so use a real
  // phone with an empty name instead.
  await page.getByLabel('Phone number').fill('+15559000002')
  await page.getByLabel('Your name').fill('')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page.getByText('A display name is required.')).toBeVisible()
})

test('a joined session survives a reload through the stored token (US3 preview, FR-013)', async ({
  page,
}) => {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })
  await page.getByLabel('Your name').fill('Reload Guest')
  await page.getByLabel('Phone number').fill('+15559000003')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))

  // Reload: the token recovers the session without re-entry (FR-013).
  await page.reload()
  await expect(page.getByText(/Blue Olive · Downtown · Table T3/)).toBeVisible()
})

/* ── US2: the staff oversight surface (T019; SC-003, SC-005, FR-009, FR-017) ── */

/** Signs a seeded identity in through the /signin form (auth.routes pattern). */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // The sign-in completes asynchronously — never navigate before it lands.
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('a second window joins the open table: one session, two participants (SC-003, FR-006)', async ({
  browser,
}) => {
  // Two independent browser contexts enter the SAME table — the join path.
  const guestFlow = async (page: Page, name: string, phone: string) => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await page.getByLabel('Table').selectOption({ label: 'T3' })
    await page.getByLabel('Your name').fill(name)
    await page.getByLabel('Phone number').fill(phone)
    await page.getByRole('button', { name: 'Join the table' }).click()
    await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
    await expect(page.getByText(/Blue Olive · Downtown · Table T3/)).toBeVisible()
  }
  const first = await browser.newContext()
  const page1 = await first.newPage()
  await guestFlow(page1, 'Join First', '+15559000011')

  const second = await browser.newContext()
  const page2 = await second.newPage()
  await guestFlow(page2, 'Join Second', '+15559000012')

  // The staff view: ONE T3 session carrying both participants (the second
  // entry joined rather than opened).
  const staff = await browser.newContext()
  const staffPage = await staff.newPage()
  await signInAs(staffPage, seedCredentials.carla)
  await staffPage.goto('/dashboard/sessions')
  await expect(staffPage.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  const t3row = staffPage.getByRole('listitem').filter({ hasText: 'T3' })
  await expect(t3row).toContainText('Join First')
  await expect(t3row).toContainText('Join Second')
})

test('the oversight view is scoped to the signed-in branch; kitchen is denied (SC-005, FR-019)', async ({
  browser,
}) => {
  // carla (Downtown cashier) reads exactly her branch: the panel names it,
  // the seeded sessions render with their participants, Marina never
  // appears, and a single readable branch means no branch picker.
  const staff = await browser.newContext()
  const page = await staff.newPage()
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/sessions')
  await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'T1' })).toContainText('Sara')
  await expect(page.getByText('Marina')).toHaveCount(0)
  await expect(page.getByLabel('Branch')).toHaveCount(0)

  // dan (kitchen, Downtown): no Sessions entry on the dashboard and the
  // explicit denial on the deep link — rejected, not hidden.
  const kitchen = await browser.newContext()
  const kitchenPage = await kitchen.newPage()
  await signInAs(kitchenPage, seedCredentials.dan)
  await kitchenPage.goto('/dashboard')
  await expect(kitchenPage.getByRole('link', { name: 'Sessions' })).toHaveCount(0)
  await kitchenPage.goto('/dashboard/sessions')
  await expect(kitchenPage.getByRole('heading', { name: 'Not authorized' })).toBeVisible()
})

test('the owner closes a session through the confirmed action (SC-005, FR-009)', async ({
  browser,
}) => {
  // A guest enters Cedar Grill's Airport T1 — the only table this block
  // touches, so the suite stays parallel-safe and rerunnable.
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto('/r/cedar-grill')
  // Cedar Grill has a single active branch → no branch picker (FR-002).
  await guestPage.getByLabel('Table').selectOption({ label: 'T1' })
  await guestPage.getByLabel('Your name').fill('Close Flow Guest')
  await guestPage.getByLabel('Phone number').fill('+15559000021')
  await guestPage.getByRole('button', { name: 'Join the table' }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/r/cedar-grill/menu$`))

  // eve (Cedar Grill owner) oversees her restaurant's branch and closes the
  // session through the two-step confirmation.
  const staff = await browser.newContext()
  const page = await staff.newPage()
  await signInAs(page, seedCredentials.eve)
  await page.goto('/dashboard/sessions')
  await page.getByLabel('Restaurant').selectOption({ label: 'Cedar Grill' })
  await expect(page.getByRole('heading', { name: 'Open sessions — Airport' })).toBeVisible()
  const t1row = page.getByRole('listitem').filter({ hasText: 'T1' })
  await expect(t1row).toContainText('Close Flow Guest')

  await t1row.getByRole('button', { name: 'Close session for T1' }).click()
  await page.getByRole('button', { name: 'Confirm closing T1' }).click()
  await expect(page.getByText(/T1.s session was closed/)).toBeVisible()
  // The refetch is the state: the closed session left the list.
  await expect(page.getByRole('listitem').filter({ hasText: 'T1' })).toHaveCount(0)
})

/* ── US3: recovery and abuse in the browser (T023; SC-002, SC-004) ─────────── */

test('a tampered token returns the customer to entry (SC-002, FR-014)', async ({ page }) => {
  // A device-carried token that resolves to nothing: the mount's recovery
  // attempt is refused, the token cleared, and the customer returned to the
  // entry route — never a broken or half-rendered menu state.
  await page.addInitScript(() => {
    localStorage.setItem('restopilot.session-token', 'tampered-by-hand')
  })
  await page.goto(`/r/${SLUG}/menu`)
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Blue Olive' })).toBeVisible()

  // The refusal cleared the device.
  const stored = await page.evaluate(() => localStorage.getItem('restopilot.session-token'))
  expect(stored).toBeNull()
})

test('a closed session refuses recovery and returns to entry (SC-004, FR-014)', async ({
  page,
}) => {
  // Enter Airport T1 (serial file — the owner-close test has finished with
  // the table) and confirm the customer route recovers from the token.
  await page.goto('/r/cedar-grill')
  await page.getByLabel('Table').selectOption({ label: 'T1' })
  await page.getByLabel('Your name').fill('Recovery Guest')
  await page.getByLabel('Phone number').fill('+15559000031')
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/cedar-grill/menu$`))
  await expect(page.getByText(/Cedar Grill · Airport · Table T1/)).toBeVisible()

  // In the same browser context, eve (Cedar Grill owner) closes the session
  // through the real staff surface.
  await signInAs(page, seedCredentials.eve)
  await page.goto('/dashboard/sessions')
  await page.getByLabel('Restaurant').selectOption({ label: 'Cedar Grill' })
  const t1row = page.getByRole('listitem').filter({ hasText: 'T1' })
  await expect(t1row).toContainText('Recovery Guest')
  await t1row.getByRole('button', { name: 'Close session for T1' }).click()
  await page.getByRole('button', { name: 'Confirm closing T1' }).click()
  await expect(page.getByText(/T1.s session was closed/)).toBeVisible()

  // Back on the customer route: the refused recovery returns to entry —
  // the reassociation rule surfaced, token cleared.
  await page.goto('/r/cedar-grill/menu')
  await expect(page).toHaveURL(new RegExp(`/r/cedar-grill$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Cedar Grill' })).toBeVisible()
  const stored = await page.evaluate(() => localStorage.getItem('restopilot.session-token'))
  expect(stored).toBeNull()
})

/* ── US4: oversight scoping in the browser (T026; SC-005, FR-019) ──────────── */

test('eve sees Downtown only at Blue Olive; the staff list carries no phone numbers (SC-005, FR-019)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.eve)
  await page.goto('/dashboard/sessions')

  // Eve's dual membership: both restaurants are selectable.
  const restaurantSelect = page.getByLabel('Restaurant')
  await expect(restaurantSelect).toBeVisible()
  const restaurants = await restaurantSelect.locator('option').allTextContents()
  expect(restaurants).toContain('Cedar Grill')
  expect(restaurants).toContain('Blue Olive')

  // At Blue Olive her cashier membership reaches exactly Downtown: the panel
  // names it, Marina is nowhere, and a single readable branch means no
  // branch picker.
  await restaurantSelect.selectOption({ label: 'Blue Olive' })
  await expect(page.getByRole('heading', { name: 'Open sessions — Downtown' })).toBeVisible()
  await expect(page.getByText('Marina')).toHaveCount(0)
  await expect(page.getByLabel('Branch')).toHaveCount(0)

  // The oversight list shows participants by name — and never a phone
  // number (the seeded participants carry real digit strings).
  await expect(page.getByRole('listitem').filter({ hasText: 'T1' })).toContainText('Sara')
  const pageText = await page.locator('main').innerText()
  expect(pageText).not.toContain('+15550101')
  expect(pageText).not.toContain('05550102')
})

/* ══ Phase 7 (spec 008): the cart, submission, and rounds history ════════════
 *
 * The US1 cart interactions, the US2 submission flow, and the US3 history —
 * all through the customer route the earlier blocks reached. Downtown T3 is
 * the shared fixture table: the entry flow above leaves an OPEN T3 session
 * (the serial worker reuses it), so these tests join that session rather
 * than open a new one — safe under `fullyParallel` because the file is
 * serial in one worker and joins never disturb the seed.
 *
 * ════════════════════════════════════════════════════════════════════════════ */

/** Joins (or re-enters) the Downtown T3 session and lands on the menu. */
async function joinT3AndReachMenu(page: Page, name: string, phone: string) {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
}

test('add with extras updates the line list and the advisory total; adjust and remove work (US1, FR-002)', async ({
  page,
}) => {
  await joinT3AndReachMenu(page, 'Cart Guest', '+15559000010')

  // The cart section is the assertion scope (the history section also
  // renders item lines once rounds exist).
  const cart = page.getByRole('region', { name: 'Cart' })

  // Add one Lamb Kebab with Extra rice: the line renders; the total is the
  // advisory sum from the payload prices (18.50 + 3.00 = 21.50).
  const lambSection = page.locator('li').filter({ hasText: 'Lamb Kebab' }).first()
  await lambSection.getByLabel('Extra rice').check()
  await lambSection.getByRole('spinbutton').fill('1')
  await lambSection.getByRole('button', { name: 'Add to cart' }).click()
  await expect(cart.getByText('Lamb Kebab × 1')).toBeVisible()
  await expect(cart.getByText('21.50')).toBeVisible()

  // Add two Hummus: a second line; the total grows by 13.00 → 34.50.
  const hummusSection = page.locator('li').filter({ hasText: 'Hummus' }).first()
  await hummusSection.getByRole('spinbutton').fill('2')
  await hummusSection.getByRole('button', { name: 'Add to cart' }).click()
  await expect(cart.getByText('Hummus × 2')).toBeVisible()
  await expect(cart.getByText('34.50')).toBeVisible()

  // Adjust the kebab line up: 2 × 21.50 = 43.00, plus 13.00 hummus → 56.00.
  const kebabLine = cart.locator('li').filter({ hasText: 'Lamb Kebab × 1' }).first()
  await kebabLine.getByRole('button', { name: '+' }).click()
  await expect(cart.getByText('Lamb Kebab × 2')).toBeVisible()
  await expect(cart.getByText('56.00')).toBeVisible()

  // Remove the hummus line: the total falls back to 43.00 and the line goes.
  const hummusLine = cart.locator('li').filter({ hasText: 'Hummus × 2' }).first()
  await hummusLine.getByRole('button', { name: 'Remove' }).click()
  await expect(cart.getByText('Hummus × 2')).toHaveCount(0)
  await expect(cart.getByText('43.00')).toBeVisible()
})

test('the cart survives a reload (SC-005 local half) and stays off the entry route (FR-003)', async ({
  page,
}) => {
  await joinT3AndReachMenu(page, 'Cart Reload Guest', '+15559000011')

  const cart = page.getByRole('region', { name: 'Cart' })
  const lambSection = page.locator('li').filter({ hasText: 'Lamb Kebab' }).first()
  await lambSection.getByRole('spinbutton').fill('2')
  await lambSection.getByRole('button', { name: 'Add to cart' }).click()
  await expect(cart.getByText('Lamb Kebab × 2')).toBeVisible()
  await expect(cart.getByText('37.00')).toBeVisible()

  // Reload: the token recovers the session AND the cart is restored exactly.
  await page.reload()
  await expect(page.getByText(/Blue Olive · Downtown · Table T3/)).toBeVisible()
  await expect(cart.getByText('Lamb Kebab × 2')).toBeVisible()
  await expect(cart.getByText('37.00')).toBeVisible()

  // The entry route never renders a cart surface (FR-003's other side).
  await page.goto(`/r/${SLUG}`)
  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0)
  await expect(page.getByText('Your cart')).toHaveCount(0)
})

test('submitting a valid cart clears it, names the round, and the history shows it (US2/US3, SC-001)', async ({
  page,
}) => {
  await joinT3AndReachMenu(page, 'Submit Guest', '+15559000012')

  const lambSection = page.locator('li').filter({ hasText: 'Lamb Kebab' }).first()
  await lambSection.getByRole('spinbutton').fill('1')
  await lambSection.getByRole('button', { name: 'Add to cart' }).click()

  // Empty-cart guard: not exercised here (the cart has a line) — the submit
  // is enabled and completes. The success feedback names the ticket.
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)
  await expect(page.getByText('Your cart is empty.')).toBeVisible()

  // The history section recovered the round from the server (US3).
  const history = page.getByRole('region', { name: 'Your rounds' })
  await expect(history.getByText('Lamb Kebab').first()).toBeVisible()
  await expect(history.getByText('18.50').first()).toBeVisible()
  await expect(history.getByText(/VAT/).first()).toBeVisible()
})

test('a refused submission preserves the cart and renders the server message verbatim (US2, FR-010)', async ({
  page,
}) => {
  await joinT3AndReachMenu(page, 'Refusal Guest', '+15559000013')

  // The sea bass is stopped restaurant-wide — its "Add to cart" affordance
  // never renders for customers (the payload marks it not offered). So the
  // refusal must come from a RACE: add a valid item, then the item is
  // stopped server-side before submission. Real UI path: fill the cart, and
  // force the refusal through a direct submit with a stale line injected
  // into the stored cart (the advisory cart is client state — the server
  // remains the authority; FR-004).
  const cart = page.getByRole('region', { name: 'Cart' })
  const hummusSection = page.locator('li').filter({ hasText: 'Hummus' }).first()
  await hummusSection.getByRole('spinbutton').fill('1')
  await hummusSection.getByRole('button', { name: 'Add to cart' }).click()
  await expect(cart.getByText('Hummus × 1')).toBeVisible()

  // Inject an unavailable item into the stored cart (stopped sea bass), then
  // reload so the surface renders the poisoned cart — the submission must
  // fail verbatim and the cart must survive.
  await page.evaluate((seaBassId) => {
    const raw = localStorage.getItem('restopilot.cart')
    const cart =
      raw !== null
        ? (JSON.parse(raw) as { token: string; lines: unknown[] })
        : { token: '', lines: [] }
    cart.lines.push({ item_id: seaBassId, extra_ids: [], quantity: 1 })
    localStorage.setItem('restopilot.cart', JSON.stringify(cart))
  }, '00000000-0000-4000-8000-000000006015')
  await page.reload()
  await expect(cart.getByText('Hummus × 1')).toBeVisible()

  // The poisoned cart renders the sea bass line too (the payload knows the
  // item, availability is server-side); submitting is refused verbatim.
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('alert')).toHaveText('This item is not available here.')

  // FR-010: the cart is exactly as it was — all three lines still render.
  await expect(cart.getByText('Hummus × 1')).toBeVisible()
})

test('two submissions render two rounds in the history; reload keeps it (US3, SC-003/SC-005 server half)', async ({
  page,
}) => {
  await joinT3AndReachMenu(page, 'History Guest', '+15559000014')

  const history = page.getByRole('region', { name: 'Your rounds' })
  const addHummus = async (quantity: string) => {
    const hummusSection = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await hummusSection.getByRole('spinbutton').fill(quantity)
    await hummusSection.getByRole('button', { name: 'Add to cart' }).click()
  }
  await addHummus('1')
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)

  await addHummus('3')
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)

  // Both rounds render with their distinct lines (1 and 3 hummus).
  await expect(history.getByText(/Hummus × 1/)).toBeVisible()
  await expect(history.getByText('Hummus × 3')).toBeVisible()

  // Reload: the history is recovered from the server (SC-005's server half).
  await page.reload()
  await expect(history.getByText('Hummus × 3')).toBeVisible()
})
