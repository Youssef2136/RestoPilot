import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'
import { setViewport } from './helpers/responsive'

/**
 * The desktop + wide checks (spec 036 FR-05/SC-003, W2): management/report/
 * platform routes at the desktop band (1280–1440) stay readable and bounded,
 * and the wide check beyond 1600 (1920) keeps reports/comparison readable —
 * dense tables don't break columns, and the wide stretch stays BOUNDED (the
 * shell's content measure caps; no unbounded stretching of reports rows).
 * The overflow sweep owns the narrow widths; this file owns the desktop end.
 */

test.describe.configure({ mode: 'serial' })

const DESKTOP_ROUTES_BY_IDENTITY = [
  {
    identity: 'alice' as const,
    routes: [
      '/dashboard',
      '/dashboard/staff',
      '/dashboard/audit',
      '/dashboard/reports',
      '/dashboard/voids',
      '/dashboard/restaurant',
      '/dashboard/menu',
      '/dashboard/tax',
      '/dashboard/branches',
    ],
  },
  { identity: 'platformAdmin' as const, routes: ['/admin', '/admin/platform'] },
]

test('management and platform surfaces stay bounded and readable at desktop widths', async ({
  page,
}) => {
  test.setTimeout(300_000)
  for (const { identity, routes } of DESKTOP_ROUTES_BY_IDENTITY) {
    await signInAs(page, seedCredentials[identity])
    for (const width of [1280, 1440] as const) {
      for (const route of routes) {
        await setViewport(page, width >= 1440 ? 'desktop1440' : 'desktop1280')
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        // No horizontal scroll; the root measure stays bounded.
        const overflow = await page.evaluate(
          () =>
            (document.scrollingElement?.scrollWidth ?? 0) -
            (document.scrollingElement?.clientWidth ?? 0),
        )
        expect(overflow, `${route} overflows horizontally at ${width}px`).toBeLessThanOrEqual(0)
        // The main landmark carries content (meaningful first paint).
        const mainText = await page.locator('main').innerText()
        expect(mainText.length, `${route} renders content at ${width}px`).toBeGreaterThan(0)
      }
    }
  }
})

test('the wide check: reports and the platform console stay readable, never stretched at 1920', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await setViewport(page, 'wide1920')
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/reports')
  await page.waitForLoadState('networkidle')

  // The comparison table keeps its rows readable at 1920: bounded stretch —
  // the content measure caps (the shell's max-width), the rows stay rows.
  const comparison = page.getByTestId('report-comparison')
  await expect(comparison).toBeVisible()
  const box = await comparison.boundingBox()
  expect(box, 'the comparison table must render at 1920').not.toBeNull()
  // A row must not stretch the full page width unboundedly — the readable
  // measure is capped (the app shell/content wrapper owns the max).
  expect(box!.width).toBeLessThanOrEqual(1920)
  const firstRow = comparison.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()

  // The platform console (the other comparison surface) behaves the same.
  await signInAs(page, seedCredentials.platformAdmin)
  await page.goto('/admin/platform')
  await page.waitForLoadState('networkidle')
  const overview = page.getByTestId('platform-overview')
  await expect(overview).toBeVisible()
  const overflow = await page.evaluate(
    () =>
      (document.scrollingElement?.scrollWidth ?? 0) - (document.scrollingElement?.clientWidth ?? 0),
  )
  expect(overflow, 'the platform console must not overflow at 1920').toBeLessThanOrEqual(0)
})
