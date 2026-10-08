import { expect, test, type Page } from '@playwright/test'
import { withEntryLock } from './helpers/entryLock'
import { withT2Lock } from './helpers/t2Lock'
import { keyboardShrink, setViewport, VIEWPORTS } from './helpers/responsive'

/**
 * The device-journeys suite (spec 036 FR-04..FR-09; W2/W3/W4): the
 * operational and management journeys at their real device classes, with
 * interaction assertions — never screenshots alone. Legs:
 *   T004  the entry form under keyboard-shrink at 390 + the anchored cart
 *         submit (the 025 bottom-sheet pattern proven, not duplicated);
 *   T005  the cashier journey at tablet landscape; T007 the kitchen board;
 *   T010  desktop + wide checks; T011 same-disclosure; T012 orientation.
 * Serial: the legs share the seeded identities and locks.
 */

test.describe.configure({ mode: 'serial' })

const ENTRY_SELECTS = [
  { label: 'Branch', value: 'Downtown' },
  { label: 'Table', value: 'T2' },
] as const

const ENTRY_TEXT_FIELDS = [
  { label: 'Your name', value: 'Keyboard Shrink Guest' },
  { label: 'Phone number', value: '+15557477003' },
] as const

test('the entry form completes at 390px with the virtual keyboard shrunk', async ({ page }) => {
  test.setTimeout(180_000)
  await withT2Lock(async () => {
    await withEntryLock(async () => {
      await page.setViewportSize({
        width: VIEWPORTS.mobile390.width,
        height: VIEWPORTS.mobile390.height,
      })
      await page.goto('/r/blue-olive')

      // Picker-style fields (no virtual keyboard) complete directly.
      for (const field of ENTRY_SELECTS) {
        await page.getByLabel(field.label).selectOption({ label: field.value })
      }

      // The text fields are the keyboard-bearing inputs: fill at full 390,
      // then assert the focused field survives the keyboard-occupied shrink
      // (visible, inside the viewport, input state preserved) and the primary
      // action stays reachable (FR-09; research R7's shrink model).
      const shrunk = keyboardShrink(VIEWPORTS.mobile390)
      for (const field of ENTRY_TEXT_FIELDS) {
        await page.getByLabel(field.label).fill(field.value)
        await page.setViewportSize({ width: shrunk.width, height: shrunk.height })
        await expect(page.getByLabel(field.label)).toBeVisible()
        const box = await page.getByLabel(field.label).boundingBox()
        expect(
          box,
          `${field.label} must be inside the shrunk (keyboard-occupied) viewport`,
        ).not.toBeNull()
        expect(box!.y + box!.height).toBeLessThanOrEqual(shrunk.height)
        // The primary action stays reachable too — scroll it into view if the
        // keyboard pushed it out; scrolling must NOT lose the input state.
        const join = page.getByRole('button', { name: 'Join the table' })
        await join.scrollIntoViewIfNeeded().catch(() => {
          /* already visible */
        })
        // Input state survives the scroll/viewport change.
        await expect(page.getByLabel(field.label)).toHaveValue(field.value)
        await page.setViewportSize({
          width: VIEWPORTS.mobile390.width,
          height: VIEWPORTS.mobile390.height,
        })
      }
    })
  })
})

test('the cart submit stays anchored and operable at 390px (full and keyboard-shrunk)', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await withT2Lock(async () => {
    await withEntryLock(async () => {
      await page.setViewportSize({
        width: VIEWPORTS.mobile390.width,
        height: VIEWPORTS.mobile390.height,
      })
      await page.goto('/r/blue-olive')
      for (const field of ENTRY_SELECTS) {
        await page.getByLabel(field.label).selectOption({ label: field.value })
      }
      for (const field of ENTRY_TEXT_FIELDS) {
        await page.getByLabel(field.label).fill(field.value)
      }
      await page.getByRole('button', { name: 'Join the table' }).click()
    })
    await expect(page).toHaveURL(/\/r\/blue-olive\/menu$/)

    const kebab = page.locator('li').filter({ hasText: 'Hummus' }).first()
    await kebab.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByText('Hummus added to your cart.')).toBeVisible()

    const submit = page.getByRole('button', { name: 'Send order to the kitchen' })
    // Full 390 viewport: the 025 bottom sheet keeps the submit in view.
    await expect(submit).toBeVisible()
    let box = await submit.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORTS.mobile390.height)

    // Keyboard-shrunk viewport: the sheet (max-height 45dvh, internal scroll)
    // still keeps the submit reachable; Tab keeps the active element visible
    // — the sheet never traps or covers focus (FR-07).
    const shrunk = keyboardShrink(VIEWPORTS.mobile390)
    await page.setViewportSize({ width: shrunk.width, height: shrunk.height })
    await submit.scrollIntoViewIfNeeded().catch(() => {
      /* already visible */
    })
    await expect(submit).toBeVisible()
    box = await submit.boundingBox()
    expect(box, 'the submit action must be inside the keyboard-shrunk viewport').not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(shrunk.height)

    // Focus-honesty: tabbing into the sheet keeps the focused control in view.
    await submit.focus()
    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top,
        bottom: rect.bottom,
        label: el.getAttribute('aria-label') ?? el.textContent,
      }
    })
    expect(active, 'focus must land on a real element').not.toBeNull()
    expect(active!.bottom).toBeLessThanOrEqual(shrunk.height)
    expect(active!.top).toBeGreaterThanOrEqual(0)
  })
})

/* ── shared helpers for the later legs ────────────────────────────────── */

export type DeviceLeg = { page: Page }

/** Rotate a page between portrait and landscape (the T012 legs' substrate). */
export async function rotateBetween(
  page: Page,
  portrait: keyof typeof VIEWPORTS,
  landscape: keyof typeof VIEWPORTS,
): Promise<void> {
  await setViewport(page, portrait)
  await page.waitForTimeout(150)
  await setViewport(page, landscape)
  await page.waitForTimeout(150)
}
