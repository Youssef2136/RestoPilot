import { test, expect } from '@playwright/test'
import { expectNoNewViolations } from './helpers/a11y'
import { ConsoleCollector } from './helpers/console'

/**
 * The design-system E2E floor (spec 022 T014; US3): the dev gallery renders
 * every primitive in every state (smoke + section assertions), passes the
 * axe WCAG 2.2 AA automatable subset with zero new violations, and keeps
 * the console clean (Phase 01 helpers, unchanged architecture).
 *
 * The chromium project runs the full suite; the mobile/tablet viewport
 * projects (Phase 01) run the responsive smoke below (explicit testMatch in
 * playwright.config keeps their budget scoped to this file's viewport test).
 *
 * DEV-only: the gallery route does not exist in production builds (spec 021
 * D3) — the dist grep in validation is the production-side proof.
 */

test.skip(process.env.NODE_ENV === 'production', 'gallery is DEV-only')

const GALLERY_SECTIONS = [
  'Buttons',
  'Fields & forms',
  'Feedback',
  'Overlays',
  'Data',
  'Structure & icons',
  'Money & totals',
  'Density (compact mode)',
]

test.describe('design system gallery (spec 022)', () => {
  test('renders every primitive section with labeled states', async ({ page }) => {
    const console_ = new ConsoleCollector(page)
    console_.attach()
    await page.goto('/dev/gallery')
    await expect(page).toHaveTitle('Dev gallery')
    await expect(page.getByRole('heading', { level: 1, name: 'Dev gallery' })).toBeVisible()

    for (const section of GALLERY_SECTIONS) {
      await expect(
        page.getByRole('heading', { level: 2, name: section }),
        `gallery section "${section}" renders`,
      ).toBeVisible()
    }

    // State labels are rendered per demo row (FR-05's "states labeled").
    await expect(page.getByText('Button primary', { exact: true })).toBeVisible()
    await expect(page.getByText('Button danger', { exact: true })).toBeVisible()
    await expect(page.getByText('StateChip (domain vocabulary)', { exact: true })).toBeVisible()

    console_.assertClean('gallery full render')
  })

  test('interactive primitives behave (dialog, tabs, toast)', async ({ page }) => {
    const console_ = new ConsoleCollector(page)
    console_.attach()
    await page.goto('/dev/gallery')

    // Dialog: opens, names itself, closes via its cancel action.
    await page.getByRole('button', { name: 'Confirm dialog' }).click()
    const dialog = page.getByRole('dialog', { name: 'Close session for Table 4' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()

    // Tabs: arrow keys move selection (roving tabindex behavior).
    const menuTab = page.getByRole('tab', { name: 'Menu' })
    await menuTab.click()
    await expect(menuTab).toHaveAttribute('aria-selected', 'true')
    await menuTab.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Tax' })).toHaveAttribute('aria-selected', 'true')

    // Toast: action outcomes announce politely and dismiss.
    await page.getByRole('button', { name: 'Toast success' }).click()
    await expect(page.getByText('Round submitted.')).toBeVisible()

    console_.assertClean('gallery interactions')
  })

  test('axe: no new WCAG violations on the gallery (chromium desktop)', async ({ page }) => {
    await page.goto('/dev/gallery')
    // The gallery IS the system's proof surface: zero violations expected —
    // primitives are accessible by construction (spec 022 FR-06). Any
    // finding is a phase defect, not a baseline entry.
    const violations = await expectNoNewViolations(page, { route: '/dev/gallery' })
    expect(violations).toEqual([])
  })

  test('responsive smoke: the system holds at mobile and tablet viewports', async ({ page }) => {
    // This file runs on ALL THREE projects (config testMatch); the desktop
    // assertion above already covers chromium, so this viewport variant is
    // for the two device projects only.
    test.skip(
      test.info().project.name === 'chromium',
      'desktop project runs the full gallery suite above',
    )

    const console_ = new ConsoleCollector(page)
    console_.attach()
    await page.goto('/dev/gallery')
    await expect(page.getByRole('heading', { level: 1, name: 'Dev gallery' })).toBeVisible()
    // No horizontal overflow at the shipped viewports (FR: responsive floor).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(1)
    console_.assertClean('gallery viewport render')
  })
})
