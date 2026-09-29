import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type RouteMeta, ROUTES, routeMetaFor } from '../../src/app/routes'

/**
 * The route-metadata registry (spec 021 FR-02 / US2, SC-001): every
 * registered path carries a title + description; the registry stays in sync
 * with the paths actually registered in router.tsx (the sweep assertion's
 * static half — the E2E sweep proves the titles render).
 */
describe('route metadata registry (spec 021 FR-02, SC-001)', () => {
  const source = readFileSync('src/app/router.tsx', 'utf8')

  it('covers exactly the paths registered in router.tsx (25 product routes)', () => {
    const registered = [...source.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
    // The catch-all renders the 404 (not a registry path); the dev gallery is
    // registered as a JSX expression (path={DEV_GALLERY_PATH}), not a literal;
    // `/` is the index route (<Route index/>) and carries no path attribute.
    const product = registered.filter((p) => p !== '/dev/gallery' && p !== '*')
    const expected = [...product, '/'].sort()
    expect([...ROUTES.map((r) => r.path)].sort()).toEqual(expected)
  })

  it('gives every route a non-empty title and description', () => {
    for (const route of ROUTES) {
      expect(route.title.trim().length, route.path).toBeGreaterThan(0)
      expect(route.description.trim().length, route.path).toBeGreaterThan(0)
    }
  })

  it('has no duplicate paths', () => {
    const paths = ROUTES.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('resolves the dev gallery only when the router supplies its entry (FR-09)', () => {
    // routes.ts carries no build-mode logic; the DEV gate lives in
    // router.tsx. Production exclusion is proven by npm run build + the
    // dist grep (gallery strings absent from the bundle).
    const devGallery: RouteMeta = {
      path: '/dev/gallery',
      title: 'Dev gallery',
      description: 'Development-only gallery of the styles and structure available so far.',
    }
    expect(routeMetaFor('/dev/gallery')?.title).toBeUndefined()
    expect(routeMetaFor('/dev/gallery', [devGallery])?.title).toBe('Dev gallery')
  })

  it('resolves parametric routes by segment shape', () => {
    expect(routeMetaFor('/r/demo-restaurant')?.title).toBe('Restaurant entry')
    expect(routeMetaFor('/r/demo-restaurant/menu')?.title).toBe('Menu')
    // Spec 024 C1: the order deep-link now redirects to the landing — its
    // title is the landing's (the redirect IS the contract).
    expect(routeMetaFor('/order/branch-1')?.title).toBe('RestoPilot')
    expect(routeMetaFor('/dashboard/branches/abc')?.title).toBe('Branch detail')
    expect(routeMetaFor('/dashboard/branches/abc/menu')?.title).toBe('Branch menu')
    expect(routeMetaFor('/dashboard/branches/abc/tax')?.title).toBe('Branch tax')
  })

  it('returns undefined for unknown paths (the 404 view owns them)', () => {
    expect(routeMetaFor('/definitely/not/registered')).toBeUndefined()
  })
})
