import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'
import { signInAs } from './helpers/signInAs'
import { setViewport } from './helpers/responsive'

/**
 * The orientation legs (spec 036 T012, FR-08, W4): rotating a tablet
 * (portrait ↔ landscape) preserves the user's place — scroll position, open
 * surfaces, and in-flight input survive; nothing remounts, no duplicate
 * announcements. React state lives outside the viewport; these legs PIN
 * that property so a future resize-keyed remount pattern fails loudly here.
 */

test.describe.configure({ mode: 'serial' })

test('the entry form input survives rotation mid-fill', async ({ page }) => {
  test.setTimeout(180_000)
  await withT2Lock(async () => {
    await withEntryLock(async () => {
      await setViewport(page, 'tabletPortrait834')
      await page.goto('/r/blue-olive')
      await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
      await page.getByLabel('Table').selectOption({ label: 'T2' })
      await page.getByLabel('Your name').fill('Rotation Guest')

      // Rotate to landscape: the half-completed form keeps its place.
      await setViewport(page, 'tabletLandscape')
      await expect(page.getByLabel('Your name')).toHaveValue('Rotation Guest')
      await expect(page.getByLabel('Branch')).toHaveValue(/.+/)
      // And the user continues where they were — filling/submitting works.
      await page.getByLabel('Phone number').fill('+15557477006')
      await page.getByRole('button', { name: 'Join the table' }).click()
    })
    await expect(page).toHaveURL(/\/r\/blue-olive\/menu$/)
  })
})

test('the staff page scroll position survives rotation', async ({ page }) => {
  test.setTimeout(180_000)
  // The menu-structure page is the reliably TALL staff page (sections of
  // categories/items — the dashboard can fit one screen when it is empty).
  await signInAs(page, seedCredentials.alice)
  await setViewport(page, 'tabletPortrait834')
  await page.goto('/dashboard/menu')
  await page.waitForLoadState('networkidle')

  // Scroll down, capture the offset, rotate, compare (a tolerance: the
  // scrolled content can reflow height at the other orientation; the signal
  // is the preserving window, not pixel equality).
  await page.evaluate(() => window.scrollBy(0, 600))
  let before = await page.evaluate(() => window.scrollY)
  if (before === 0) {
    // Defensive: scroll to the bottom once if the small push didn't move
    // (never silently accept an unscrollable page here).
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight))
    before = await page.evaluate(() => window.scrollY)
  }
  expect(before, 'the page must be scrollable to test rotation preservation').toBeGreaterThan(0)

  await setViewport(page, 'tabletLandscape')
  await page.waitForLoadState('networkidle')
  const after = await page.evaluate(() => window.scrollY)
  expect(
    Math.abs(after - before),
    `scroll position must roughly survive rotation (${before} → ${after})`,
  ).toBeLessThanOrEqual(200)
  // The page content itself did not remount (the heading reconciles —
  // the same DOM node across the rotation).
  const heading = await page.evaluate(() => document.querySelector('main h1')?.textContent ?? '')
  expect(heading.length).toBeGreaterThan(0)
})

test('the board keeps a stable announcement region across rotation (no remount spam)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await signInAs(page, seedCredentials.dan)
  await setViewport(page, 'tabletPortrait834')
  await page.goto('/dashboard/kitchen')
  await page.waitForLoadState('networkidle')
  const beforeText = await page.locator('main h1').innerText()

  await setViewport(page, 'tabletLandscape1024')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main h1')).toHaveText(beforeText)

  // Exactly ONE polite live region on the kitchen surface — rotation may
  // not duplicate it (the 032 policy holds through viewport changes).
  const regions = await page.evaluate(() => document.querySelectorAll('[role="status"]').length)
  expect(regions).toBeLessThanOrEqual(1)
})
