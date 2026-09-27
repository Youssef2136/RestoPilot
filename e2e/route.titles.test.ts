import { expect, test } from '@playwright/test'
import { ConsoleCollector } from './helpers/console'
import { routeMetaFor } from '../src/app/routes'

/**
 * The route-metadata sweep (spec 021 FR-02/FR-04 / US2, SC-001/SC-002) with
 * the console-cleanliness floor (FR-08, F-G14 semantics).
 *
 * Scope: the routes reachable signed-out without sign-ins (rate-limit
 * discipline, phase 0 decision D4) — public routes plus the guarded staff
 * entries, which redirect to sign-in. The title assertions use the registry
 * directly (routeMetaFor), so the sweep proves the registry → document
 * binding on every reachable route; the registry↔router sync is unit-pinned
 * (tests/unit/routeRegistry.test.ts).
 */

// The sweep matrix: signed-out-reachable routes. Guarded staff entries
// redirect to /signin signed-out — their FINAL landing is what the sweep
// asserts (the redirect is the guards' tested contract; the registry's
// guarded-route titles are unit-pinned and verified in authenticated phases).
const sweep: { path: string; landsOn?: string }[] = [
  { path: '/' },
  { path: '/r/demo-restaurant' },
  { path: '/order/demo-branch' },
  { path: '/signin' },
  { path: '/reset-password' },
  { path: '/account/password' },
  { path: '/dashboard', landsOn: '/signin' },
  { path: '/admin', landsOn: '/signin' },
]

for (const { path, landsOn } of sweep) {
  test(`route ${path} applies the registry title, description, and stays console-clean`, async ({
    page,
  }) => {
    const collector = new ConsoleCollector(page)
    collector.attach()

    await page.goto(path)
    await page.waitForLoadState('networkidle')
    // The signed-out redirect flips in an effect after a synchronous session
    // read (no network), so networkidle can precede it — settle on the final
    // URL before reading the registry binding.
    if (landsOn) {
      await page.waitForURL(landsOn)
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }

    const pathname = new URL(page.url()).pathname
    const meta = routeMetaFor(pathname)
    expect(meta, `registry covers ${pathname}`).toBeDefined()
    if (meta) {
      await expect(page).toHaveTitle(meta.title)
      const description = await page.getAttribute('meta[name="description"]', 'content')
      expect(description).toBe(meta.description)
    }

    collector.assertClean(`route ${path}`)
  })
}

test('unknown path renders the dedicated 404 view (FR-04, Q1)', async ({ page }) => {
  await page.goto('/definitely/not/a/route')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to the entry page' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to dashboard' })).toBeVisible()
})

test('404 links navigate back to working routes', async ({ page }) => {
  await page.goto('/definitely/not/a/route')
  await page.getByRole('link', { name: 'Go to the entry page' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'RestoPilot' })).toBeVisible()
})

test('the dev gallery applies its registry title in dev builds (FR-09)', async ({ page }) => {
  await page.goto('/dev/gallery')
  await expect(page).toHaveTitle('Dev gallery')
  await expect(page.getByRole('heading', { level: 1, name: 'Dev gallery' })).toBeVisible()
})
