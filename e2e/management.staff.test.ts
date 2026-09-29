import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/**
 * Management staff & section-nav E2E (spec 026 T007): the phase's NEW
 * assertions — provisioning presentation with a scratch identity (unique
 * email per run, removed in-test), the one-time credential reveal
 * (copy affordance + shown-once note + dismissal), the removal consequence
 * dialog, the last-owner refusal verbatim, section-fragment navigation on
 * the restaurant page, the scoped member's read-only badge, and the 390px
 * card-row fallback for the staff list.
 *
 * Serial in one worker; a single alice sign-in context per test (fresh
 * contexts per test keep the sign-in count within the Auth rate limit).
 */

const STAFF_URL = '/dashboard/staff'
const RESTAURANT_URL = '/dashboard/restaurant'

test.describe.configure({ mode: 'serial' })

test('the restaurant page section nav reflects fragments and reaches the QR card (FR-01, Q1)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(RESTAURANT_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Restaurant' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Restaurant sections' })
  await nav.getByRole('button', { name: 'Entry QR' }).click()

  // The fragment is reflected and the QR section is in view (the panel's
  // pinned heading rides inside the phase's SectionCard).
  await expect(page).toHaveURL(/#qr/)
  await expect(page.getByRole('heading', { name: 'Customer entry QR' })).toBeInViewport()
})

test('the owner provisions a scratch identity and the credential shows exactly once (FR-05)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(STAFF_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff list' })).toBeVisible()

  // Unique per run — a failed earlier run leaves its member behind (the
  // credential step died mid-test), so names never collide across runs, and
  // the bounded pre-cleanup below reaps the residue.
  const staffName = `E2E Scratch ${Date.now()}`
  const email = `e2e-scratch-${Date.now()}@restopilot.dev`

  // Bounded self-cleanup: remove leftover scratch members from earlier runs
  // (each removal goes through the same consequence dialog).
  for (let i = 0; i < 5; i += 1) {
    const removeButton = page.getByRole('button', { name: /^Remove E2E Scratch/ }).first()
    if (!(await removeButton.isVisible().catch(() => false))) {
      break
    }
    await removeButton.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /^Confirm removal for E2E Scratch/ }).click()
    await expect(page.getByText(/'s access to this restaurant\./)).toBeVisible()
  }

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Display name').fill(staffName)
  await page.getByLabel('Role').selectOption({ label: 'Cashier' })
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByRole('button', { name: 'Add staff member' }).click()

  // The credential reveal is unmissable: heading, outcome wording, the
  // secret, the copy affordance, and the shown-once notice.
  const credential = page.getByRole('heading', { name: 'One-time temporary credential' })
  await expect(credential).toBeVisible()
  await expect(
    page.getByText(/The new person can sign in with this temporary credential\./),
  ).toBeVisible()
  const secret = page.locator('code').filter({ hasText: /^[0-9a-f]{24}$/ })
  await expect(secret).toBeVisible()
  // The copy affordance needs the clipboard in headless — granted explicitly;
  // without it the panel's documented 'unavailable' degradation shows instead.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy credential' }).click()
  await expect(page.getByText('Copied.')).toBeVisible()
  await expect(page.getByText(/not shown again/)).toBeVisible()

  // The scratch member now renders in the Existing members list.
  await expect(page.getByText(`${staffName} — Cashier`)).toBeVisible()

  // Self-cleaning removal: the consequence dialog states access ends now and
  // the person persists; confirming removes the membership.
  await page.getByRole('button', { name: `Remove ${staffName}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Their profile and sign-in identity remain.')
  await dialog.getByRole('button', { name: `Confirm removal for ${staffName}` }).click()
  await expect(page.getByText(`Removed ${staffName}'s access to this restaurant.`)).toBeVisible()
  await expect(page.getByText(`${staffName} — Cashier`)).toHaveCount(0)
})

test('removing the last owner is refused with the server message verbatim (FR-05)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(STAFF_URL)

  // Alice is the sole seeded owner of Blue Olive: the removal dialog opens,
  // and the confirm hits the RPC's last-owner safeguard, verbatim.
  await page.getByRole('button', { name: 'Remove Alice' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirm removal for Alice' }).click()
  // The RPC's last-owner safeguard, verbatim.
  await expect(page.getByRole('alert')).toContainText(
    'A restaurant always keeps at least one owner.',
  )
  // Alice's membership survives (the dialog closes with the refusal shown).
  await expect(page.getByText(/Alice — Owner/)).toBeVisible()
})

test('a scoped member sees the read-only badge and no owner controls (FR-10, Q4)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await page.goto(`/dashboard/branches/${'00000000-0000-4000-8000-000000000101'}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown' })).toBeVisible()

  // Both managed sections (hours + tables) carry the read-only badge.
  await expect(page.getByText('Read-only')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Create table' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save working hours' })).toHaveCount(0)
})

test('the staff list falls back to card rows at 390px (Responsive)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page, seedCredentials.alice)
  await page.goto(STAFF_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff list' })).toBeVisible()

  // No horizontal overflow at the phone viewport; rows carry their labels.
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    clientWidth: document.scrollingElement?.clientWidth ?? 0,
  }))
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1)
  await expect(page.getByText('Name', { exact: true }).first()).toBeHidden()
  await expect(page.locator('td[data-label="Name"]').first()).toBeVisible()
})
