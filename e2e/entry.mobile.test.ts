import { expect, test } from '@playwright/test'
import { ConsoleCollector } from './helpers/console'

/**
 * The customer entry at 390 px (spec 024 T005; Responsive + a11y + UX
 * Requirements). The full dine-in journey — branch, channel, table,
 * identity, submit — completes on a phone viewport: no horizontal overflow,
 * ≥ 44 px primary target, sticky primary action visible at submit time,
 * console-clean navigation (the entry's expected refusals are client-side
 * validation messages, not console errors).
 *
 * Runs on the desktop chromium project (viewport is set per-test) so it
 * participates in the normal suite; the two viewport projects cover the
 * overflow-only smoke for the same route.
 */

const SLUG = 'blue-olive'

test('a guest completes the full entry on a 390px phone (spec 024)', async ({ page }) => {
  test.setTimeout(60_000)
  const consoleCollector = new ConsoleCollector(page)
  consoleCollector.attach()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/r/${SLUG}`)

  // The restaurant identity leads (h1 = restaurant name, frozen).
  await expect(page.getByRole('heading', { level: 1, name: 'Blue Olive' })).toBeVisible()
  // The brand line renders (seeded brand_description).
  await expect(page.getByText(/Wood-fired Mediterranean plates/)).toBeVisible()

  // No horizontal overflow at the phone width.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })
  expect(overflow, 'entry overflows horizontally at 390px').toBeLessThanOrEqual(1)

  // The progressive single page: branch → channel appears → table appears.
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await expect(page.getByText('How would you like your order?')).toBeVisible()
  // The join guidance (Q4) sits under the table picker.
  await expect(page.getByText(/join it as a new participant/)).toBeVisible()
  await page.getByLabel('Table').selectOption({ label: 'T3' })

  // Identity fields carry the mobile hints (inputMode/autoComplete).
  const nameInput = page.getByLabel('Your name')
  await expect(nameInput).toHaveAttribute('autocomplete', 'name')
  const phoneInput = page.getByLabel('Phone number')
  await expect(phoneInput).toHaveAttribute('inputMode', 'tel')
  await expect(phoneInput).toHaveAttribute('autocomplete', 'tel')

  await nameInput.fill('Mobile Guest')
  await phoneInput.fill('+15557770002')

  // The sticky primary action is visible AT submit time (it must not be
  // pushed below the fold by the fields above it).
  const join = page.getByRole('button', { name: 'Join the table' })
  await expect(join).toBeVisible()
  const box = await join.boundingBox()
  expect(box, 'primary action has a ≥44px target').not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.y).toBeLessThan(844)

  await join.click()
  await expect(page).toHaveURL(new RegExp(`/r/${SLUG}/menu$`))
  await expect(page.getByText(/Blue Olive · Downtown · Table T3/)).toBeVisible()

  consoleCollector.assertClean('the 390px entry journey')
})

test('client-side refusal focuses the first invalid field on the phone (spec 024 a11y)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/r/${SLUG}`)
  await page.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await page.getByLabel('Table').selectOption({ label: 'T3' })
  await page.getByLabel('Phone number').fill('not-a-phone')
  await page.getByRole('button', { name: 'Join the table' }).click()
  // The SAME verbatim message as today + focus moved to the name field (the
  // first invalid one — empty while the phone is also invalid).
  await expect(page.getByRole('alert')).toHaveText('A display name is required.')
  await expect(page.getByLabel('Your name')).toBeFocused()
})
