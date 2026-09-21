import { expect, test, type Page } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'

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

/** Signs a seeded identity in through the /signin form (auth.routes pattern). */
async function signInAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

/** Submit one dine-in round as a real customer (the 009 e2e journey). */
async function submitCustomerRound(
  browser: import('@playwright/test').Browser,
  tableLabel: string,
  itemName: string,
): Promise<void> {
  const page = await browser.newPage()
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: tableLabel })
  await page.getByLabel('Your name').fill('E2E Void Customer')
  await page.getByLabel('Phone number').fill('+15550889')
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
  const locked = page.locator('[data-round-state="lock"]').first()
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
