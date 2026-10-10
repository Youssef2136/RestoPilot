import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { withEntryLock } from './helpers/entryLock'

/**
 * Bill, void & audit E2E (spec 011 T011/T012; US1/US2/US3, FR-001..FR-005,
 * FR-009/FR-010, SC-002/SC-005).
 *
 * US2: carla locks a REAL customer round (the Phase 9 journey on the public
 * surface), then voids it from the dashboard with a reason — the card shows
 * the voided display state and the bill shows the voided section with the
 * grand total reduced by exactly that round's captured total. The empty-
 * reason refusal is a client feedback state (the confirm button stays
 * disabled); the server's refusals render verbatim when they fire.
 *
 * US3: alice (owner) sees the audit trail with the `round.void` entry and
 * the visible reason; bob (branch manager) is branch-scoped to his Downtown
 * membership; the journey runs serially in one worker (kitchen.cashier
 * precedent) because the void is the audit's subject.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/**
 * The audit trail's `round.void` subject is created by this file's FIRST
 * test — but the serial pairing only holds when the seeded state STARTS
 * writable: leftover sessions from a previous run (e.g. another suite
 * consumed the demo T1/T2 sessions' join paths before this file's reset)
 * make the fresh T3 entry fail before the void is ever created. A reset in
 * the worker makes the file's meaning independent of run order
 * (npm run db:reset -- --yes — the standing protocol).
 */
test.beforeAll(async () => {
  const { execSync } = await import('node:child_process')
  execSync('npm run db:reset -- --yes', { stdio: 'inherit', cwd: process.cwd() })
})

/** Signs a seeded identity in through the /signin form (auth.routes pattern). */
/** Submit one dine-in round as a real customer (the 009 e2e journey). */
async function submitCustomerRound(
  browser: import('@playwright/test').Browser,
  tableLabel: string,
  itemName: string,
): Promise<void> {
  const page = await browser.newPage()
  // The customer entry queues on the shared entry lock: a concurrent
  // platform kill-switch test would refuse this submit otherwise.
  await withEntryLock(async () => {
    await page.goto(`/r/${SLUG}`)
    await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
    await page.getByLabel('Table').selectOption({ label: tableLabel })
    await page.getByLabel('Your name').fill('E2E Void Customer')
    await page.getByLabel('Phone number').fill('+15550889')
    await page.getByRole('button', { name: 'Join the table' }).click()
  })
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

test('carla voids a locked real round; the bill shows the voided section and the reduced total (FR-004, FR-003)', async ({
  page,
  browser,
}) => {
  await submitCustomerRound(browser, 'T3', 'Hummus')

  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')

  // Drive the real round to the dine-in void boundary (`lock`): the exact
  // 009 journey — accept, start, ready, lock.
  const incoming = page.locator('[data-round-state="new"]')
  await expect(incoming.first()).toBeVisible()
  await incoming.first().getByRole('button', { name: 'Accept round' }).click()
  await expect(page.locator('[data-round-state="accepted"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="accepted"]')
    .first()
    .getByRole('button', { name: 'Start preparation' })
    .click()
  await expect(page.locator('[data-round-state="preparing"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="preparing"]')
    .first()
    .getByRole('button', { name: /mark ready|ready/i })
    .click()
  await expect(page.locator('[data-round-state="ready"]').first()).toBeVisible()
  await page
    .locator('[data-round-state="ready"]')
    .first()
    .getByRole('button', { name: 'Lock round' })
    .click()
  // Scope the locked card to THIS journey's round: the seeded fixture carries
  // a VOIDED lock-state round (T2, 'E2E: wrong order'), and a bare .first()
  // over '[data-round-state="lock"]' resolves it the instant the Lock click
  // lands — before this run's refetch promotes our card — after which a
  // voided card offers no Void round control at all (the timeout this run
  // hit). Exclude voided cards; ours is the only non-voided lock under the
  // fresh reset the suite assumes.
  const locked = page.locator('article[data-round-state="lock"]:not([data-voided="true"])').first()
  await expect(locked).toBeVisible()

  // Scope every later interaction to THIS run's round by id — earlier runs'
  // rounds accumulate in T3's open session and would otherwise be ambiguous.
  const roundId = await locked.getAttribute('data-round-id')
  expect(roundId).toBeTruthy()
  const myCard = page.locator(`article[data-round-id="${roundId}"]`)

  // The bill BEFORE the void: open it and record the grand total as rendered.
  await myCard.getByLabel('Show bill').check()
  const bill = page.getByTestId('session-bill')
  await expect(bill).toBeVisible()
  const beforeText = await bill.getByTestId('bill-grand-total').innerText()
  const before = parseFloat(beforeText.replace(/[^0-9.]/g, ''))
  await myCard.getByLabel('Show bill').uncheck()

  // The empty-reason feedback: opening the prompt leaves Confirm disabled
  // until a reason exists (the client's non-empty check as feedback only),
  // and Cancel recovers the closed prompt state.
  await myCard.getByRole('button', { name: 'Void round' }).click()
  await expect(myCard.getByRole('button', { name: 'Confirm void' })).toBeDisabled()
  await myCard.getByRole('button', { name: 'Cancel' }).click()
  await expect(myCard.getByRole('button', { name: 'Void round' })).toBeVisible()
  await myCard.getByRole('button', { name: 'Void round' }).click()
  await myCard.getByLabel('Void reason').fill('Guest left before eating')
  await expect(myCard.getByRole('button', { name: 'Confirm void' })).toBeEnabled()
  await myCard.getByRole('button', { name: 'Confirm void' }).click()

  // The voided display state on the card (the overlay, not a state change).
  const voidedCard = page.locator(`article[data-round-id="${roundId}"][data-voided="true"]`)
  await expect(voidedCard).toBeVisible()
  await expect(voidedCard).toContainText('Guest left before eating')

  // The bill (US1): the voided section renders with the reason, and the
  // grand total dropped by EXACTLY this round's captured total (Hummus
  // 6.50 + tax 7.28) — the void reduces the bill, other rounds unaffected.
  await myCard.getByLabel('Show bill').check()
  const voidedSection = bill.getByTestId('bill-voided-section')
  // Wait for the REFETCHED payload first (the void's invalidation lands) —
  // reading the total earlier races the cached pre-void bill.
  await expect(voidedSection).toContainText('Guest left before eating')
  // The delta equals THIS round's captured figures (its own voided line),
  // not the whole section — earlier runs' voided rounds render here too.
  const myVoidedLine = bill.locator(`[data-bill-voided-round="${roundId}"]`)
  await expect(myVoidedLine).toContainText('Guest left before eating')
  const voidedText = await myVoidedLine.innerText()
  const figures = [...voidedText.matchAll(/([0-9]+\.[0-9]{2})/g)].map((m) => parseFloat(m[1]!))
  expect(figures.length).toBe(2)
  const afterText = await bill.getByTestId('bill-grand-total').innerText()
  const after = parseFloat(afterText.replace(/[^0-9.]/g, ''))
  expect(after).toBeCloseTo(before - (figures[0]! + figures[1]!), 2)
})

test('alice sees the audit trail with the round.void entry; bob is branch-scoped (FR-009, FR-010)', async ({
  page,
  browser,
}) => {
  // The audit subject is the void from the first test (serial file).
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/audit')

  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  const voidRows = page.locator('[data-audit-action="round.void"]')
  await expect(voidRows.first()).toBeVisible()
  await expect(voidRows.first()).toContainText('Guest left before eating')

  // The filter narrows: an action that never occurs yields the empty state
  // (an exact-match filter — no prefix matching to lean on).
  await page.getByLabel('Action').fill('no.such.action')
  await expect(page.getByText('No audit entries match.')).toBeVisible()
  await page.getByLabel('Action').fill('round.void')
  await expect(voidRows.first()).toBeVisible()

  await page.close()

  // Bob is a branch_manager — the trail renders for his Downtown membership.
  const bobPage = await browser.newPage()
  await signInAs(bobPage, seedCredentials.bob)
  await bobPage.goto('/dashboard/audit')
  await expect(bobPage.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  // His reach is branch-scoped; the void on Downtown is inside it.
  await expect(bobPage.locator('[data-audit-action="round.void"]').first()).toBeVisible()
  await bobPage.close()
})
