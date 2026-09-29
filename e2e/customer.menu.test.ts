import { expect, test } from '@playwright/test'
import { expectNoNewViolations } from './helpers/a11y'

/**
 * Customer menu E2E (spec 025 T010/T011): the phase's NEW assertions over
 * the re-skinned `/r/:slug/menu` — category navigation with counts, the
 * add-to-cart feedback contract, the designed empty states, the freshness
 * affordance on the 10 s poll, the 390 px mobile journey, and the axe floor
 * on the menu route.
 *
 * The file is serial in one worker and joins Downtown T2 — deliberately NOT
 * T3, whose surface carries the frozen session.surfaces pins. Expected
 * refusals (F-G14): none in this file — the poisoned-cart, cutoff, and
 * closed-session refusal scenarios stay in session.surfaces where they are
 * already named.
 */

const SLUG = 'blue-olive'

test.describe.configure({ mode: 'serial' })

/** Joins (or re-enters) the Downtown T2 session and lands on the menu. */
async function joinT2AndReachMenu(
  page: import('@playwright/test').Page,
  name: string,
  phone: string,
) {
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T2' })
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Phone number').fill(phone)
  await page.getByRole('button', { name: 'Join the table' }).click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
}

test('the category bar counts offered items, keeps unavailability visible, and navigates (FR-01, FR-02)', async ({
  page,
}) => {
  await joinT2AndReachMenu(page, 'Category Guest', '+15559100010')

  const nav = page.getByRole('navigation', { name: 'Menu categories' })
  // Counts are OFFERED counts: Mains seeds three items, one stopped — two.
  await expect(nav.getByRole('button', { name: 'Starters (3)' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Mains (2)' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Desserts (3)' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Drinks (3)' })).toBeVisible()

  // Unavailability is visible, never a mystery hiding (FR-02): the sea bass
  // renders its struck price and its reason, with no add affordance.
  const seaBass = page.locator('li').filter({ hasText: 'Grilled Sea Bass' }).first()
  await expect(seaBass.getByText('not available here')).toBeVisible()
  await expect(seaBass.getByRole('button', { name: 'Add to cart' })).toHaveCount(0)

  // Navigation scrolls in-page to the category (FR-01 as clarified — Q2).
  await nav.getByRole('button', { name: 'Desserts (3)' }).click()
  await expect(page.getByRole('heading', { name: 'Desserts', level: 3 })).toBeInViewport()
})

test('adding with extras announces the result in place and never navigates away (FR-03)', async ({
  page,
}) => {
  await joinT2AndReachMenu(page, 'Add Feedback Guest', '+15559100011')

  const urlBefore = page.url()
  const cart = page.getByRole('region', { name: 'Cart' })
  const kebab = page.locator('li').filter({ hasText: 'Lamb Kebab' }).first()
  await kebab.getByLabel('Extra rice').check()
  await kebab.getByRole('spinbutton').fill('2')
  await kebab.getByRole('button', { name: 'Add to cart' }).click()

  // Immediate feedback: the announced live region and the updated cart line
  // with the advisory total (18.50 + 3.00) × 2 = 43.00 — no navigation.
  await expect(page.getByText('Lamb Kebab added to your cart.')).toBeVisible()
  await expect(cart.getByText('Lamb Kebab × 2')).toBeVisible()
  await expect(cart.getByText('43.00')).toBeVisible()
  expect(page.url()).toBe(urlBefore)
})

test('the designed empty states render for a fresh guest (FR-11)', async ({ page }) => {
  await joinT2AndReachMenu(page, 'Empty States Guest', '+15559100012')

  // The cart (token-scoped) starts empty with its designed state; the
  // history region renders with its freshness affordance whether or not
  // this shared session already carries rounds from earlier runs.
  await expect(
    page.getByRole('region', { name: 'Cart' }).getByText('Your cart is empty.'),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Your rounds' }).getByText(/Updated \d+s ago/),
  ).toBeVisible()
})

test('the freshness affordance renders and the manual refresh refetches (FR-09)', async ({
  page,
}) => {
  await joinT2AndReachMenu(page, 'Freshness Guest', '+15559100013')

  const history = page.getByRole('region', { name: 'Your rounds' })
  await expect(history.getByText(/Updated \d+s ago/)).toBeVisible()

  // The 10 s cadence ticks the counter up; the manual refresh resets it.
  await expect(history.getByText(/Updated ([2-9]|1\d)s ago/)).toBeVisible({ timeout: 15_000 })
  await history.getByRole('button', { name: 'Refresh' }).click()
  await expect(history.getByText(/Updated [01]s ago/)).toBeVisible()
})

test('the full journey completes on a 390 px phone with no horizontal scrolling (exit criteria)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await joinT2AndReachMenu(page, 'Mobile Journey Guest', '+15559100014')

  // No horizontal scrolling at the design target (320–430 px band's anchor).
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    clientWidth: document.scrollingElement?.clientWidth ?? 0,
  }))
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1)

  // Order on the phone: add, submit, see the captured money in the history.
  const hummus = page.locator('li').filter({ hasText: 'Hummus' }).first()
  await hummus.getByRole('spinbutton').fill('2')
  await hummus.getByRole('button', { name: 'Add to cart' }).click()
  await page.getByRole('button', { name: 'Send order to the kitchen' }).click()
  await expect(page.getByRole('status')).toContainText(/ticket/i)

  const history = page.getByRole('region', { name: 'Your rounds' })
  await expect(history.getByText('Hummus × 2').first()).toBeVisible()
  await expect(history.getByText('13.00').first()).toBeVisible()
  await expect(history.getByText('Subtotal')).toBeVisible()
  await expect(history.getByText('Total', { exact: true })).toBeVisible()

  // The cart sheet stays reachable one-handed at the bottom of the screen.
  await expect(page.getByRole('region', { name: 'Cart' })).toBeVisible()
})

test('the menu route passes the axe WCAG 2.2 AA floor (session-gated scan)', async ({ page }) => {
  await joinT2AndReachMenu(page, 'Axe Guest', '+15559100015')
  // The menu route needs a session token, so it cannot join the signed-out
  // a11y.baseline sweep — the floor runs here, in-session, with the same
  // committed-baseline discipline.
  await expectNoNewViolations(page, { route: '/r/blue-olive/menu' })
})
