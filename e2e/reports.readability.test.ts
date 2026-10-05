import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { signInAs } from './helpers/signInAs'

/**
 * Reports readability E2E (spec 033; Master Plan §Frontend Phase 13) — the
 * honesty/readability layer the existing suites did not cover:
 *
 * 1. the comparison's same-period sentence (FR-05/D1), the zero hint (D6),
 *    and the token-driven bars (D4/FA-10) on the owner's report;
 * 2. the audit filter's exact-match semantics stated (D7), the clamp notice
 *    ABSENT below the page size (D2), and the exact-match filter behavior
 *    unchanged;
 * 3. 390px: all three tables reflow to labelled card rows with no
 *    horizontal overflow (D3/R3) + axe (WCAG 2.2 AA) on the three desktop
 *    pages.
 *
 * Read-only: NO data is created here — every assertion runs on the shared
 * seeded context, so the suite neither races the writers nor needs locks.
 */

test.describe.configure({ mode: 'serial' })

test('the comparison states its same-period guarantee and the zero/empty story reads honestly', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/reports')

  // The owner picker keeps both branches; the comparison renders with the
  // period sentence derived from the anchored branch's server bounds.
  const picker = page.getByLabel('Branch')
  await expect(picker).toBeVisible()
  await page.getByTestId('report-comparison').waitFor()
  // The sentence names the SAME range for every branch and points at the
  // per-row copies (D1).
  const sentence = page.locator('p', { hasText: 'Same ' })
  await expect(sentence).toContainText('for every branch:')
  await expect(sentence).toContainText('every row loads its own copy')

  // Bars are aria-hidden decoration next to real numbers (FA-10).
  const bars = page.locator(
    '[data-testid="report-channels"] .barTrack, [data-testid="report-best-sellers"] .barTrack',
  )
  const barCount = await bars.count()
  if (barCount > 0) {
    for (let i = 0; i < barCount; i += 1) {
      await expect(bars.nth(i)).toHaveAttribute('aria-hidden', 'true')
    }
  }

  // D6: an empty future period renders the zero hint while keeping the
  // server's zero figures (the frozen zero-state assertions still hold).
  await page.getByLabel('Anchor date').fill('2030-01-01')
  await expect(page.getByTestId('report-aggregates')).toContainText('0')
  await expect(page.getByText('Nothing was recorded in this period.')).toBeVisible()
})

test('the audit filter states its exact-match semantics and the clamp notice stays honest', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/audit')

  // D7: the filter's description says EXACTLY what it does.
  const hint = page.getByText('Matches the full action name exactly')
  await expect(hint).toBeVisible()
  await expect(page.getByLabel('Action')).toHaveAttribute('aria-describedby', /audit-action-hint/)

  // The exact-match behavior is unchanged (the frozen suite's contract):
  // the table renders (with the day's rows or the no-match row), and a
  // partial guess matches nothing — exact means exact.
  await page.getByLabel('Action').fill('round.void')
  await expect(page.getByTestId('audit-table')).toBeVisible()
  await page.getByLabel('Action').fill('round.voided-partial-guess')
  await expect(page.getByTestId('audit-table')).toContainText('No audit entries match.')
  await page.getByLabel('Action').fill('')

  // D2: below the clamp (the seeded trail is far under 200) no clamp
  // notice renders — the trail does not claim truncation it doesn't have.
  await expect(page.getByText('Showing the most recent 200 entries')).toHaveCount(0)
})

test('390px: the three report tables reflow to card rows with no overflow (D3)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  await page.goto('/dashboard/reports')
  await expect(page.getByTestId('report-channels')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  // The card fallback labels every cell (the thead is out of flow); the
  // channels table always carries its three rows, so it is the canonical
  // row-card proof. The mechanism class is pinned here once.
  await expect(page.getByTestId('report-channels')).toHaveClass(/cardTable/)
  await expect(
    page.locator('[data-testid="report-channels"] td[data-label="Channel"]').first(),
  ).toBeVisible()

  await page.goto('/dashboard/voids')
  await expect(
    page.getByTestId('void-log-table').or(page.getByTestId('void-log-empty')),
  ).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)

  await page.goto('/dashboard/audit')
  await expect(page.getByTestId('audit-table')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  // The seeded trail may legitimately be empty (rows are written by real
  // voids/price actions, not by the seed) — the honest 390px posture is the
  // card table OR the frozen empty row, never a broken layout.
  await expect(
    page
      .locator('[data-testid="audit-table"] td[data-label="When"]')
      .or(page.getByText('No audit entries match.'))
      .first(),
  ).toBeVisible()
})

test('axe: the three report pages hold the WCAG 2.2 AA floor (desktop)', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)

  await page.goto('/dashboard/reports')
  await expect(page.getByTestId('report-aggregates')).toBeVisible()
  await expectNoNewViolations(page, { route: '/dashboard/reports' })

  await page.goto('/dashboard/voids')
  await expect(
    page.getByTestId('void-log-table').or(page.getByTestId('void-log-empty')),
  ).toBeVisible()
  await expectNoNewViolations(page, { route: '/dashboard/voids' })

  await page.goto('/dashboard/audit')
  await expect(page.getByTestId('audit-table')).toBeVisible()
  await expectNoNewViolations(page, { route: '/dashboard/audit' })
})
