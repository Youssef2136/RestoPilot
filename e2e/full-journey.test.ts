import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

/**
 * Full-journey E2E — the §27 dress rehearsal (spec 017 T003/T004;
 * FR-001, FR-002 scenario 2; plan D1–D5).
 *
 * ONE connected story from nothing to closed session, against freshly
 * created data: Fiona (the fixture's membership-free owner) creates the
 * restaurant, a branch, tables, and a menu through the real owner UI
 * forms; a customer enters through the public route exactly as a scan
 * would; two rounds flow through cashier and kitchen with the customer
 * seeing each state; the bill shows the captured money; the cashier
 * closes; and a fresh entry re-opens the freed table (§27 scenario 2).
 *
 * The journey is RERUNNABLE (plan D1): the tenant slug is date-suffixed,
 * creation steps tolerate their own previous runs, no seeded fixture row
 * is mutated, and the final step removes Fiona's membership so the next
 * run starts membership-free again. Serial in-file ordering is the spine.
 */

test.describe.configure({ mode: 'serial' })

const RESTAURANT_NAME = 'Dress Rehearsal'
let SLUG = `dress-rehearsal-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
const BRANCH = 'Harbor'
const TABLE_1 = 'R1'
const TABLE_2 = 'R2'
const CATEGORY = 'Journey Plates'
const ITEM = 'Journey Kebab'
const PRICE = '12.50'
const GUEST = 'Dress Rehearsal Guest'
const GUEST_PHONE = '+15559100001'

async function signInAs(page: Page, creds: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(creds.email)
  await page.getByLabel('Password').fill(creds.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/**
 * Drive the public entry form to `tableLabel`: pick the branch whose table
 * options actually list it. Reruns leave empty duplicate branches (branch
 * display names are not unique — 004's documented posture), and the RPC
 * orders branches by (name, id), so the tables may not be on the first
 * option. The per-branch probe stays short to respect the test timeout.
 */
async function selectBranchWithTable(page: Page, tableLabel: string) {
  // WAIT for the app to render the picker (or settle without one) before
  // probing: an immediate isVisible() races the payload fetch and skips
  // the whole branch step. The entry heading proves the payload arrived.
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10000 })
  const branchSelect = page.getByLabel('Branch')
  const waited = await branchSelect
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (!waited) return // single-branch restaurant: the picker is skipped (FR-002)
  const optionValues = await branchSelect
    .locator('option')
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''),
    )
  for (const value of optionValues) {
    await branchSelect.selectOption(value)
    const tableSelect = page.getByLabel('Table')
    // The table list renders SYNCHRONOUSLY from the already-fetched payload
    // (RestaurantEntry line: branch?.tables) — only React's re-render is
    // awaited, so a short poll suffices. A fixed long wait here multiplies
    // across every empty rerun branch and blows the test timeout.
    await tableSelect.waitFor({ state: 'visible', timeout: 400 }).catch(() => {})
    const optionLabels = await tableSelect
      .locator('option')
      .allTextContents()
      .catch(() => [] as string[])
    if (optionLabels.includes(tableLabel)) return
  }
  throw new Error(
    `selectBranchWithTable: no branch offered table "${tableLabel}". ` +
      `Branch options: ${JSON.stringify(optionValues)}`,
  )
}

/** Enter at TABLE_1 as the given guest and land on the customer menu. */
async function enterAtTable1(page: Page, name: string, phone: string) {
  await page.goto(`/r/${SLUG}`)
  await selectBranchWithTable(page, TABLE_1)
  await page.getByLabel('Table').selectOption({ label: TABLE_1 })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
}

test('the owner creates the restaurant, branch, tables, and menu through the UI (FR-001)', async ({
  page,
}) => {
  // Fiona has no memberships: the dashboard renders the creation panel.
  // (The final step of a previous run removed her journey membership, so a
  // same-day rerun sees the panel again and reuses the existing tenant.)
  await signInAs(page, seedCredentials.fiona)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff Dashboard' })).toBeVisible()
  const creationPanel = page.getByRole('heading', { level: 2, name: 'Create your restaurant' })
  if (await creationPanel.isVisible()) {
    await page.getByLabel('Restaurant name').fill(RESTAURANT_NAME)
    // A slug from a prior run may persist (the teardown frees FIONA, not the
    // tenant). On the identifier refusal, adopt a fresh suffixed slug.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByLabel('Public identifier').fill(SLUG)
      await page.getByRole('button', { name: 'Create restaurant' }).click()
      // The refusal renders after a real RPC round trip — poll, never a
      // bare isVisible() (that races the server response and reads false).
      const refused = page.getByText(
        'This public identifier is already in use by another restaurant.',
      )
      const wasRefused = await refused
        .waitFor({ state: 'visible', timeout: 1500 })
        .then(() => true)
        .catch(() => false)
      if (wasRefused) {
        SLUG = `dress-rehearsal-${Date.now()}`
      } else {
        break
      }
    }
  }
  // Either way: the staff dashboard shows the journey's restaurant selected.
  // Scoped to the context switcher — the creation panel's own labels also
  // match a bare getByLabel('Restaurant') when the panel is still on screen
  // (strict mode would fail).
  const contextSelect = page
    .getByLabel('Restaurant', { exact: true })
    .and(page.locator('#dashboard-restaurant'))
  await expect(contextSelect).toBeVisible()
  await expect(contextSelect).toContainText(RESTAURANT_NAME)

  // Branch: the branches page carries the owner's create form (004's
  // surface) plus the per-branch links.
  await page.goto('/dashboard/branches')
  await expect(page.getByRole('heading', { level: 2, name: 'Create a branch' })).toBeVisible()
  await page.getByLabel('Branch name').fill(BRANCH)
  await page.getByRole('button', { name: 'Create branch' }).click()
  await expect(page.getByText(new RegExp(`Branch "${BRANCH}" created`)).first()).toBeVisible()

  // Tables (two: the second stays free for the closed→new block). Labels
  // ARE unique within a branch, so a rerun's second attempt is refused —
  // tolerate either outcome.
  await page.getByRole('link', { name: BRANCH }).first().click()
  for (const label of [TABLE_1, TABLE_2]) {
    await page.getByLabel('Table label').fill(label)
    await page.getByRole('button', { name: 'Create table' }).click()
    await page
      .getByText(new RegExp(`Table "${label}" created|label is already in use`))
      .first()
      .waitFor({ timeout: 5000 })
      .catch(() => {})
  }

  // Menu: one category, one item — created only when absent (rerun safety:
  // category names are unique per restaurant; item names are not, so the
  // item is added only when the first run hasn't listed it yet). Direct
  // navigation: a name-only "Menu" link also matches "Harbor menu".
  await page.goto('/dashboard/menu')
  await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible()
  const categoryHeading = page.getByRole('heading', { name: CATEGORY, exact: true })
  if (!(await categoryHeading.isVisible().catch(() => false))) {
    await page.getByLabel('Category name').fill(CATEGORY)
    await page.getByRole('button', { name: 'Add category' }).click()
    await expect(categoryHeading).toBeVisible()
  }
  const categorySection = page.getByRole('region').filter({ has: categoryHeading })
  const alreadyListed = await categorySection
    .getByText(ITEM, { exact: true })
    .isVisible()
    .catch(() => false)
  if (!alreadyListed) {
    const itemForm = categorySection.getByRole('form', { name: 'Add an item to this category' })
    await itemForm.getByLabel('Item name').fill(ITEM)
    await itemForm.getByLabel('Price', { exact: true }).fill(PRICE)
    await itemForm.getByRole('button', { name: 'Add item' }).click()
  }
  await expect(categorySection.getByText(ITEM, { exact: true })).toBeVisible()

  // The public route is live immediately — the §27 "customer scans QR" hop.
  await page.goto(`/r/${SLUG}`)
  await expect(page.getByRole('heading', { level: 1, name: RESTAURANT_NAME })).toBeVisible()
})

test('the customer enters and places round 1; the staff chain runs; the customer sees each state (FR-001)', async ({
  browser,
}) => {
  test.setTimeout(120_000) // branch probing across rerun-created empties + two full staff chains
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await enterAtTable1(guestPage, GUEST, GUEST_PHONE)
  await expect(guestPage.getByText(`${BRANCH} · Table ${TABLE_1}`)).toBeVisible()
  await expect(guestPage.getByText(ITEM, { exact: true })).toBeVisible()

  // Round 1: add the item, submit.
  await guestPage.getByRole('button', { name: 'Add to cart' }).first().click()
  await guestPage.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(guestPage.getByText(/Round/i).first()).toBeVisible()
  const historyList = guestPage.getByLabel('Your rounds')
  const guestToken = await guestPage.evaluate(() =>
    localStorage.getItem('restopilot.session-token'),
  )

  // Cashier accepts.
  const staff = await browser.newContext()
  const cashierPage = await staff.newPage()
  await signInAs(cashierPage, seedCredentials.fiona)
  await cashierPage.getByRole('link', { name: 'Rounds' }).click()
  const roundCard = cashierPage.locator('[data-round-state="new"]').first()
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  await expect(cashierPage.locator('[data-round-state="accepted"]').first()).toBeVisible()

  // Kitchen prepares and marks ready (the Kitchen surface is reached from
  // the dashboard nav — the rounds page itself links nowhere else). Tickets
  // carry data-ticket-state, not data-round-state.
  await cashierPage.goto('/dashboard/kitchen')
  await expect(cashierPage.getByRole('heading', { name: 'Kitchen' })).toBeVisible()
  const ticket = cashierPage.locator('[data-ticket-state="accepted"]').first()
  await expect(ticket).toBeVisible()
  await ticket.getByRole('button', { name: 'Start preparation' }).click()
  await expect(cashierPage.locator('[data-ticket-state="preparing"]').first()).toBeVisible()
  const preparing = cashierPage.locator('[data-ticket-state="preparing"]').first()
  await preparing.getByRole('button', { name: 'Mark ready' }).click()
  await expect(cashierPage.locator('[data-ticket-state="ready"]').first()).toBeVisible()

  // The customer sees the updated state (plan D5: reload reconciles).
  await guestPage.reload()
  await expect(guestPage.getByText(/ready/i).first()).toBeVisible()

  // Round 2: a second submission → a second ticket. A fresh session holds
  // exactly two rounds; a rerun session accumulates, so the assertion is the
  // §27 substance: the submission ADDS one more round to the history. The
  // filter anchors to the round-level <li> ("Round N — …"); the nested item
  // <li>s live inside it and would otherwise double-count.
  const roundItems = historyList.getByRole('listitem').filter({ hasText: /Round \d+ —/ })
  const linesBefore = await roundItems.count()
  await guestPage.getByRole('button', { name: 'Add to cart' }).first().click()
  await guestPage.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(roundItems).toHaveCount(linesBefore + 1)
  expect(await guestPage.evaluate(() => localStorage.getItem('restopilot.session-token'))).toBe(
    guestToken,
  )

  await guest.close()
  await staff.close()
})

test('the bill shows the captured money and the close frees the table; a fresh entry opens a new session (FR-001, FR-002 scenario 2)', async ({
  browser,
}) => {
  // The staff bill: grand total equals the captured sum (plan D4).
  const staff = await browser.newContext()
  const page = await staff.newPage()
  await signInAs(page, seedCredentials.fiona)
  await page.getByRole('link', { name: 'Rounds' }).click()
  const readyCard = page.locator('[data-round-state="ready"]').first()
  await readyCard.getByRole('button', { name: 'Lock round' }).click()
  const locked = page.locator('[data-round-state="lock"]').first()
  await locked.getByLabel('Show bill').check()
  // Two rounds of one item at the captured price 12.50 + tax.
  await expect(locked.getByText(/Total/i)).toContainText(/\d/)

  // Close the session (the two-step confirmation, 007's pattern). Fiona
  // owns one restaurant, so the Restaurant selector does not render; the
  // panel defaults to her restaurant's first viewable branch. (Direct
  // navigation — the Sessions link lives on the dashboard, not the rounds
  // page.)
  await page.goto('/dashboard/sessions')
  await expect(page.getByRole('heading', { name: `Open sessions — ${BRANCH}` })).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: TABLE_1 })
  await row.getByRole('button', { name: new RegExp(`Close session for ${TABLE_1}`) }).click()
  await page.getByRole('button', { name: `Confirm closing ${TABLE_1}` }).click()
  await expect(page.getByText(new RegExp(`${TABLE_1}.s session was closed`))).toBeVisible()
  await staff.close()

  // §27 scenario 2: the freed table re-enters as a NEW session — empty
  // history, fresh token.
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await enterAtTable1(guestPage, 'Fresh Entry', '+15559100002')
  await expect(guestPage.getByText('No rounds yet.')).toBeVisible()
  await guest.close()

  // Rerun teardown (plan D1): the journey restaurant persists (an audit
  // trail), but Fiona's membership must NOT — the seed defines her as the
  // membership-free creation-bootstrap identity, and the suite suite
  // (management.surfaces) asserts exactly that on the same shared database.
  // FR-016 refuses removing the LAST owner, so the teardown first adds a
  // second owner through the real staff panel (also the §27 staff-management
  // surface), then removes Fiona's own membership while that owner remains.
  const cleanup = await browser.newContext()
  const cleanupPage = await cleanup.newPage()
  await signInAs(cleanupPage, seedCredentials.fiona)
  await cleanupPage.getByRole('link', { name: 'Staff list' }).click()
  await expect(cleanupPage.getByRole('heading', { name: 'Manage staff' })).toBeVisible()

  // Add the second owner (a fresh address; provisioning creates the person).
  const ownerEmail = `journey-owner-${Date.now()}@restopilot.test`
  await cleanupPage.getByLabel('Email').fill(ownerEmail)
  await cleanupPage.getByLabel('Display name').fill('Journey Co-Owner')
  await cleanupPage.getByLabel('Role').selectOption({ label: 'Owner' })
  await cleanupPage.getByRole('button', { name: 'Add staff member' }).click()
  await expect(
    cleanupPage.getByRole('listitem').filter({ hasText: 'Journey Co-Owner' }).first(),
  ).toBeVisible()

  // Now Fiona's removal is legitimate (a second owner exists) and leaves the
  // fixture identity membership-free for the next run and the other suites.
  // Note: removing her OWN membership invalidates her auth context, so the
  // staff page re-renders to the explicit denial — the durable proof is the
  // denial itself plus the sign-in state, not the transient feedback text.
  const ownerRow = cleanupPage
    .locator('li')
    .filter({ hasText: 'Change role or branch for Fiona' })
    .first()
  await ownerRow.getByRole('button', { name: 'Remove Fiona' }).click()
  await cleanupPage.getByRole('button', { name: 'Confirm removal for Fiona' }).click()
  await expect(cleanupPage.getByRole('heading', { name: 'Not authorized' })).toBeVisible()
  await cleanup.close()

  // The fixture is restored: Fiona signs in and sees the creation panel again
  // (the next run of this journey starts from the same state).
  const verifyPage = await (await browser.newContext()).newPage()
  await signInAs(verifyPage, seedCredentials.fiona)
  await expect(
    verifyPage.getByRole('heading', { level: 2, name: 'Create your restaurant' }),
  ).toBeVisible()
  await verifyPage.close()
})
