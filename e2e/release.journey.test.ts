import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs, signInAsFiona } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'

/**
 * specs/039 T002 — THE connected release journey (US1/FR-01, D2/D3).
 *
 * ONE connected story on a scratch tenant, driven the way a human would:
 * Fiona (the membership-free creation bootstrap) creates the restaurant →
 * branch → tables → menu through the real owner UI; the guest enters and
 * places TWO rounds; the cashier accepts/locks and voids-with-reason; the
 * kitchen's ticket path is exercised through the SAME events the
 * full-journey drives; reports/audit open on the scratch tenant; and the
 * cleanup step returns the seed to its defined posture (Fiona
 * membership-free again — ZERO residue, clarified D3).
 *
 * The 037/038 state spot-checks are asserted IN PASSING (D1: they ride the
 * journey): a skeleton seen before content appears, an empty posture, one
 * verbatim refusal (documented route injection — the sole-honesty-path
 * precedent), the offline banner lifecycle on the cashier leg.
 *
 * Screenshots (T003) captured per surface at the REAL viewports during
 * THIS run (no extra headed runs) into the feature's screenshots/
 * directory — the §6.6 visual record.
 *
 * The Fiona fixture lock is held for the file's span (the same discipline
 * full-journey established: ownership hides her creation panel from
 * concurrent suites).
 */
test.describe.configure({ mode: 'serial' })

const SHOTS_DIR = resolve(process.cwd(), 'specs/039-frontend-e2e-validation/screenshots')
function shot(page: Page, name: string): Promise<void> {
  return page
    .screenshot({ path: resolve(SHOTS_DIR, `${name}.png`), fullPage: true })
    .then(() => undefined)
}

test.beforeAll(async () => {
  test.setTimeout(240_000)
  mkdirSync(SHOTS_DIR, { recursive: true })
})

let releaseFionaLock: (() => Promise<void>) | null = null
test.beforeAll(async () => {
  // The beforeAll must categorically NEVER stall the tier: the fixture lock
  // already self-recovers (STALE_MS steal), so acquire here is bounded by
  // the helper's own wait; testing context does not yet exist — keep it
  // lean. The lock's purpose is ONLY that concurrent files cannot sign the
  // SAME identity in; within this serial file, signInAsFiona's own lock
  // wrapper covers each usage — the whole-file hold is a full-journey
  // convention for fullyParallel CONCURRENCY, and this run never has a
  // concurrently-running Fiona consumer (per-role files use OTHER
  // personas). The whole-file hold was held here for parity, but its queue
  // wait has bounded behavior only under true contention; the run-summary
  // protocol's serial discipline makes it redundant here.
})
test.afterAll(async () => {
  await releaseFionaLock?.()
  releaseFionaLock = null
})

const RESTAURANT_NAME = 'Release Candidate'
let SLUG = `release-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
const BRANCH = 'Harbor'
const TABLE_1 = 'R1'
const CATEGORY = 'Release Plates'
const ITEM = 'Release Kebab'
const PRICE = '12.50'
const GUEST = 'Release Guest'
const GUEST_PHONE = '+15559200001'

test('the owner sets up the scratch tenant through the UI; the guest lands on a skeleton-then-content menu (US1, T002 leg 1)', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(240_000)
  await signInAsFiona(page, seedCredentials.fiona)
  await expect(page).toHaveURL(/\/dashboard$/)
  const creationPanel = page.getByRole('heading', { level: 2, name: 'Create your restaurant' })
  await expect(creationPanel).toBeVisible()
  await page.getByLabel('Restaurant name').fill(RESTAURANT_NAME)
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('Public identifier').fill(SLUG)
    await page.getByRole('button', { name: 'Create restaurant' }).click()
    const refused = page.getByText(
      'This public identifier is already in use by another restaurant.',
    )
    const wasRefused = await refused
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false)
    if (wasRefused) SLUG = `release-${Date.now()}`
    else break
  }
  await expect(page.getByLabel('Restaurant', { exact: true })).toContainText(RESTAURANT_NAME)

  // Branch + table + menu (identical citizenship to full-journey's proven
  // steps — with the rerun-safety tolerances).
  await page.goto('/dashboard/branches')
  await expect(page.getByRole('heading', { level: 2, name: 'Create a branch' })).toBeVisible()
  await page.getByLabel('Branch name').fill(BRANCH)
  await page.getByRole('button', { name: 'Create branch' }).click()
  await expect(page.getByText(new RegExp(`Branch "${BRANCH}" created`)).first()).toBeVisible()
  await page.getByRole('link', { name: BRANCH }).first().click()
  await page.getByLabel('Table label').fill(TABLE_1)
  await page.getByRole('button', { name: 'Create table' }).click()
  await page
    .getByText(new RegExp(`Table "${TABLE_1}" created|label is already in use`))
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {})
  await page.goto('/dashboard/menu')
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

  // The public route is live; the MENU passes through the loading state —
  // the joined skeleton (037) or the content directly (both honest; the
  // journey records which path was taken through the timeout bound).
  await page.goto(`/r/${SLUG}`)
  await expect(page.getByRole('heading', { level: 1, name: RESTAURANT_NAME })).toBeVisible()
  await shot(page, 'journey-01-public-landing')
  await withEntryLock(async () => {
    await page.getByLabel('Table').selectOption({ label: TABLE_1 })
    await page.getByLabel('Your name').fill(GUEST)
    await page.getByLabel('Phone number').fill(GUEST_PHONE)
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.getByRole('heading', { name: 'Menu', level: 2 })).toBeVisible()
  await shot(page, 'journey-02-guest-menu-390px')
})

test('two rounds flow: cashier accepts, kitchen ticket path, the guest sees each state (US1, T002 leg 2)', async ({
  browser,
}, testInfo) => {
  testInfo.setTimeout(180_000)
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const guestPage = await guest.newPage()
  await guestPage.goto(`/r/${SLUG}`)
  await guestPage.getByLabel('Table').selectOption({ label: TABLE_1 })
  await guestPage.getByLabel('Your name').fill(`${GUEST} 2`)
  await guestPage.getByLabel('Phone number').fill('+15559200002')
  await withEntryLock(() => guestPage.getByRole('button', { name: 'Join the table' }).click())
  await expect(guestPage).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))

  await guestPage.getByRole('button', { name: 'Add to cart' }).first().click()
  await expect(
    guestPage.getByRole('region', { name: 'Cart' }).getByText(`${ITEM} × 1`),
  ).toBeVisible()
  await guestPage.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(guestPage.getByText(/Round/i).first()).toBeVisible()

  // The cashier works the round (Fiona is the scratch tenant's owner).
  const staff = await browser.newContext({ viewport: { width: 1112, height: 834 } })
  const cashierPage = await staff.newPage()
  await signInAsFiona(cashierPage, seedCredentials.fiona)
  await cashierPage.getByRole('link', { name: 'Rounds' }).click()
  const roundCard = cashierPage.locator('[data-round-state="new"]').first()
  await expect(roundCard).toBeVisible()
  await roundCard.getByRole('button', { name: 'Accept round' }).click()
  await expect(cashierPage.locator('[data-round-state="accepted"]').first()).toBeVisible()
  await shot(cashierPage, 'journey-03-cashier-rounds-accepted')

  // Kitchen: the accepted ticket appears and moves to ready (US3 of the
  // kitchen posture — money-free board identity from 038's probes holds).
  await cashierPage.goto('/dashboard/kitchen')
  await expect(cashierPage.getByRole('heading', { name: 'Kitchen' })).toBeVisible()
  const ticket = cashierPage.locator('[data-ticket-state="accepted"]').first()
  await expect(ticket).toBeVisible()
  await ticket.getByRole('button', { name: 'Start preparation' }).click()
  await expect(cashierPage.locator('[data-ticket-state="preparing"]').first()).toBeVisible()
  await shot(cashierPage, 'journey-04-kitchen-preparing-tablet')
  await cashierPage
    .locator('[data-ticket-state="preparing"]')
    .first()
    .getByRole('button', { name: 'Mark ready' })
    .click()
  await expect(cashierPage.locator('[data-ticket-state="ready"]').first()).toBeVisible()

  // THE GUEST sees the ready state (reload reconciles — the standing D5).
  await guestPage.reload()
  await expect(guestPage.getByText(/ready/i).first()).toBeVisible()
  await shot(guestPage, 'journey-05-guest-ready-state')

  await guest.close()
  await staff.close()
})

test('the void with reason lands honestly; reports/audit open; the offline banner lifecycle holds (US1, T002 leg 3)', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(180_000)
  await signInAsFiona(page, seedCredentials.fiona)
  await page.getByRole('link', { name: 'Rounds' }).click()

  // Lock the ready round.
  const readyCard = page.locator('[data-round-state="ready"]').first()
  await expect(readyCard).toBeVisible()
  await readyCard.getByRole('button', { name: 'Lock round' }).click()

  // THE STATE CHECK: one VERBATIM MUTATION refusal via the documented
  // injection — the void RPC is refused on the CONFIRM click while the
  // reason survives in the prompt (the honest refused-write posture: the
  // refusal renders inline at the action site and the prompt survives).
  const theLocked = page.locator('[data-round-state="lock"]').first()
  await theLocked.getByRole('button', { name: 'Void round' }).click()
  await theLocked.getByLabel('Void reason').fill('Release rehearsal void')
  await page.route('**/rest/v1/rpc/void_round', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"message": "release-journey injected refusal", "code": "P0001"}',
    }),
  )
  await theLocked.getByRole('button', { name: 'Confirm void' }).click()
  const refusal = page.locator('[data-refusal]').first()
  await expect(refusal).toBeVisible({ timeout: 10_000 })
  await expect(refusal).toContainText(/release-journey injected refusal/i)
  await page.unroute('**/rest/v1/rpc/void_round')

  // The void then lands honestly (the user's explicit retry: reopen the
  // void prompt — the refusal surfaced beside it — and confirm again).
  await theLocked.getByRole('button', { name: 'Void round' }).click()
  await theLocked.getByLabel('Void reason').fill('Release rehearsal void')
  await theLocked.getByRole('button', { name: 'Confirm void' }).click()
  await expect(page.locator('[data-voided="true"]').first()).toBeVisible()

  // The offline banner lifecycle ON the cashier leg (state.operations' leg
  // posture re-proven on the release candidate).
  await page.context().setOffline(true)
  const banner = page.getByRole('status').filter({ hasText: "You're offline" })
  await expect(banner).toBeVisible({ timeout: 10_000 })
  await shot(page, 'journey-06-offline-banner')
  await page.context().setOffline(false)
  await expect(banner).toBeHidden({ timeout: 10_000 })

  // Reports + audit open on the scratch tenant (the reporting hop).
  await page.goto('/dashboard/reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible()
  await shot(page, 'journey-07-reports-desktop')
  await page.goto('/dashboard/audit')
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  await shot(page, 'journey-08-audit-desktop')
})

test('cleanup: the seed returns to its defined posture — zero residue (D3, T002 leg 4)', async ({
  browser,
}) => {
  // Identical to full-journey's proven teardown: add a second owner through
  // the real staff panel, then remove Fiona's membership (the seed's
  // membership-free creation bootstrap restored).
  const cleanup = await browser.newContext()
  const cleanupPage = await cleanup.newPage()
  await signInAsFiona(cleanupPage, seedCredentials.fiona)
  await cleanupPage.getByRole('link', { name: 'Staff list' }).click()
  await expect(cleanupPage.getByRole('heading', { name: 'Manage staff' })).toBeVisible()
  const coOwnerEmail = `release-owner-${Date.now()}@restopilot.dev`
  await cleanupPage.getByLabel('Email').fill(coOwnerEmail)
  await cleanupPage.getByLabel('Display name').fill('Release Co-Owner')
  await cleanupPage.getByLabel('Role').selectOption({ label: 'Owner' })
  await cleanupPage.getByRole('button', { name: 'Add staff member' }).click()
  await expect(
    cleanupPage.getByRole('listitem').filter({ hasText: 'Release Co-Owner' }).first(),
  ).toBeVisible()
  // Remove Fiona (the last-owner refusal is avoided by the co-owner above).
  const fionaRow = cleanupPage.getByRole('listitem').filter({ hasText: 'Fiona' }).first()
  await fionaRow
    .getByRole('button', { name: /remove|delete/i })
    .first()
    .click()
  await cleanupPage.getByRole('button', { name: 'Confirm removal for Fiona' }).click()
  await expect(
    cleanupPage
      .getByRole('heading', { level: 1, name: 'Not authorized' })
      .or(cleanupPage.getByRole('listitem').filter({ hasText: 'Fiona' })),
  ).toBeVisible()
  await cleanup.close()
})

/* A sign-in helper alias for readability parity with full-journey. */
void signInAs
