import { expect, type Page } from '@playwright/test'

/**
 * The responsive substrate (spec 036 FR-03/FR-08; research R1/R3/R6/R7).
 *
 * The viewport set is the Master Plan's bands mapped onto the standing
 * Playwright anchors (390×844 mobile, 834×1112 tablet — spec 021 FR-08).
 * `expectNoHorizontalOverflow` is the honest overflow measure: the scrolling
 * element must not scroll horizontally AND no rendered element may extend
 * past the viewport's right edge (the clipped-content case a root scrollbar
 * cannot see — e.g. `overflow-x: hidden` hiding a clipped control).
 */

export type Viewport = { width: number; height: number; name: string }

export const VIEWPORTS = {
  mobile320: { width: 320, height: 568, name: 'mobile-320' },
  mobile390: { width: 390, height: 844, name: 'mobile-390' },
  mobile430: { width: 430, height: 932, name: 'mobile-430' },
  tabletPortrait768: { width: 768, height: 1024, name: 'tablet-portrait-768' },
  tabletPortrait834: { width: 834, height: 1112, name: 'tablet-portrait-834' },
  tabletLandscape: { width: 1112, height: 834, name: 'tablet-landscape-1112x834' },
  tabletLandscape1024: { width: 1024, height: 768, name: 'tablet-landscape-1024x768' },
  desktop1280: { width: 1280, height: 720, name: 'desktop-1280' },
  desktop1440: { width: 1440, height: 900, name: 'desktop-1440' },
  wide1600: { width: 1600, height: 900, name: 'wide-1600' },
  wide1920: { width: 1920, height: 1080, name: 'wide-1920' },
} satisfies Record<string, Viewport>

export type ViewportKey = keyof typeof VIEWPORTS

/** Switch the page to a named viewport (the suites address them by key). */
export async function setViewport(page: Page, key: ViewportKey): Promise<void> {
  const { width, height } = VIEWPORTS[key]
  await page.setViewportSize({ width, height })
}

/**
 * The rotated viewport of a portrait tablet anchor — the tablet-landscape
 * posture (FR-04). 834×1112 → 1112×834; 768×1024 → 1024×768.
 */
export function rotate(vp: Viewport): Viewport {
  return { width: vp.height, height: vp.width, name: `${vp.name}-rotated` }
}

/**
 * The keyboard-occupied viewport at 390 px (FR-09; research R7 — no real IME
 * in CI, so the shrink model reproduces the actual harm: the focused field
 * and the primary action must remain reachable in the shrunk viewport).
 */
export function keyboardShrink(vp: Viewport): Viewport {
  return { width: vp.width, height: Math.round(vp.height * 0.55), name: `${vp.name}-kb` }
}

/**
 * Assert the page does not horizontally overflow at its current viewport:
 *
 * (a) the scrolling element's `scrollWidth` does not exceed its `clientWidth`
 *     — no horizontal page scroll at all; and
 * (b) no rendered element extends past the viewport's right edge — the
 *     clipped-content case a root scrollbar cannot see (an `overflow-x:
 *     hidden` ancestor silently hiding an unreachable control fails here).
 *
 * Content inside a REAL scroll container (`overflow-x: auto`/`scroll`) is
 * exempt: it scrolls within its container (the documented scroll-region
 * pattern — ManagementLayout's section nav, the reports scroll region), it
 * does not widen the page. Zero-size and hidden elements are ignored; the
 * tolerance covers sub-pixel rounding and shadows.
 */
export async function expectNoHorizontalOverflow(page: Page, tolerance = 2): Promise<void> {
  const result = await page.evaluate((tol) => {
    const scrolling = document.scrollingElement
    if (!scrolling) return { rootOverflow: 0, offenders: [] as string[] }

    const rootOverflow = scrolling.scrollWidth - scrolling.clientWidth

    const insideScrollContainer = (el: Element): boolean => {
      let node = el.parentElement
      while (node && node !== document.body) {
        const s = window.getComputedStyle(node)
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true
        node = node.parentElement
      }
      return false
    }

    const offenders: string[] = []
    const viewportRight = window.innerWidth
    for (const el of document.body.querySelectorAll('*')) {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right <= viewportRight + tol) continue
      if (insideScrollContainer(el)) continue
      const tag = el.tagName.toLowerCase()
      const cls =
        typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''
      offenders.push(`${tag}${cls} right=${Math.round(rect.right)} viewport=${viewportRight}`)
    }
    return { rootOverflow, offenders: offenders.slice(0, 10) }
  }, tolerance)

  const problem =
    result.rootOverflow > 0 || result.offenders.length > 0
      ? `horizontal overflow found — the scrolling element overflows by ${result.rootOverflow}px;
  right-edge offenders (up to 10):
  ${result.offenders.join('\n  ') || '(none — the root overflow comes from margins/scrollbars, not an element box)'}`
      : null
  expect(problem, problem ?? '').toBeNull()
}
