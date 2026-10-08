import { expect, test } from '@playwright/test'
import { expectNoNewViolations } from './helpers/a11y'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'

/**
 * The touch-target floor (spec 035 FR-07/T011, D5): axe's `target-size`
 * rule (WCAG 2.2 AA — the committed floor's own tool) asserted at the
 * MOBILE (390×844) and TABLET (834×1112) viewports on the surfaces the
 * matrix's default-viewport scan cannot see at these widths, including the
 * IN-SESSION customer menu — the ground zero of the recorded 031 A3
 * finding (the cart micro-buttons; fixed by specs/031's CSS, proven here).
 *
 * The rule's UA-default exception (WCAG 2.5.8 d: controls unmodified by
 * the author are exempt) is axe's to apply — the first sweep prototype
 * enumerated bare bounding boxes and mis-flagged author-untouched native
 * controls; the committed axe rule is the authority this spec asserts.
 * Findings outside the baseline fail; baseline entries carry a written
 * justification and the owning phase (035 fixes serious-plus).
 */

test.describe.configure({ mode: 'serial' })

test('the entry and sign-in surfaces hold the axe floor at 390px', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/signin')
  await page.waitForLoadState('networkidle')
  await expectNoNewViolations(page, { route: '/signin' })
  await page.goto('/r/blue-olive')
  await page.waitForLoadState('networkidle')
  await expectNoNewViolations(page, { route: '/r/blue-olive' })
})

test('the customer menu (in-session) holds the axe floor at 390px — the A3 ground zero', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await withT2Lock(async () => {
    await withEntryLock(async () => {
      await page.goto('/r/blue-olive')
      await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
      await page.getByLabel('Table').selectOption({ label: 'T2' })
      await page.getByLabel('Your name').fill('Touch Target Guest')
      await page.getByLabel('Phone number').fill('+15557477003')
      await page.getByRole('button', { name: 'Join the table' }).click()
    })
    await expect(page).toHaveURL(/\/r\/blue-olive\/menu$/)
    // The cart must carry content for the A3 micro-buttons to render.
    const kebab = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await kebab.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByText('Hummus added to your cart.')).toBeVisible()
    // The first axe scan of this route at 390px WITH cart content — the
    // state the 031 record described, now standing-proofed.
    await expectNoNewViolations(page, { route: '/r/blue-olive/menu' })
  })
})

test('the staff surfaces hold the axe floor at 390px and 834px', async ({ page }) => {
  test.setTimeout(180_000)
  const { signInAs } = await import('./helpers/signInAs')
  const { seedCredentials } = await import('../tests/database/helpers/fixtures')

  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page, seedCredentials.carla)
  await page.goto('/dashboard/rounds')
  await page.waitForLoadState('networkidle')
  await expectNoNewViolations(page, { route: '/dashboard/rounds' })

  await page.setViewportSize({ width: 834, height: 1112 })
  await page.goto('/dashboard/rounds')
  await page.waitForLoadState('networkidle')
  await expectNoNewViolations(page, { route: '/dashboard/rounds' })

  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  await page.waitForLoadState('networkidle')
  await expectNoNewViolations(page, { route: '/admin/platform' })
})
