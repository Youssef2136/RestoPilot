import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedCredentials, branchIds } from '../../tests/database/helpers/fixtures'
import { signInAs, signInAsFiona } from './signInAs'

/**
 * The axe floor (spec 021 FR-07 / US4; WCAG 2.2 AA per Clarification Q2).
 *
 * `expectNoNewViolations` runs the automatable WCAG 2.2 AA rule set against
 * the page and fails on any finding not present in the committed baseline.
 * The baseline is an explicit, reviewed record — findings are never silently
 * waived: each entry names the rule, the selector, and the owning phase.
 *
 * Adding an entry requires a justification comment and the phase that owns
 * the remediation. The floor then re-asserts the rest of the page.
 */

export type A11yViolation = {
  id: string
  impact: string | null
  nodes: { target: string[] }[]
}

/**
 * The committed baseline: findings on the pre-design surfaces, each owned by
 * the phase that will remediate it. Empty entries would mean axe found
 * nothing — real entries are added only with a written justification.
 */
export const A11Y_BASELINE: Record<
  string,
  { id: string; target: string; justification: string }[]
> = {
  // No baseline findings at Phase 01: the four scanned routes came back
  // clean under the 2.2 AA automatable subset (recorded in the phase
  // report). Future findings go here with justification + owning phase.
}

/** Format violations for assertion messages. */
function formatViolations(violations: A11yViolation[]): string {
  return violations
    .map(
      (v) =>
        `${v.id}${v.impact ? ` (${v.impact})` : ''} on ${JSON.stringify(v.nodes.map((n) => n.target))}`,
    )
    .join('\n  ')
}

/**
 * Run the axe scan and fail if any violation is not accounted for by the
 * committed baseline. Returns the (unwaived) violations for callers that
 * want to record them as evidence.
 */
export async function expectNoNewViolations(
  page: Page,
  options: { route: string },
): Promise<A11yViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  const violations = results.violations as A11yViolation[]
  const baseline = A11Y_BASELINE[options.route] ?? []

  const unwaived = violations.filter((v) => {
    const waived = baseline.filter((b) => b.id === v.id)
    if (waived.length === 0) return true
    // Every instance of a waived rule must be covered by a baseline entry.
    return v.nodes.length > waived.length
  })

  expect(
    unwaived,
    `New accessibility violations on ${options.route}:\n  ${formatViolations(unwaived)}`,
  ).toEqual([])
  return unwaived
}

/**
 * The route×state matrix row (spec 035 FR-01/FR-09): one route scanned in
 * one authorized state. `identity: null` = the signed-out posture; the
 * shell declares which chrome's floor (skip link + main landmark) applies.
 * `viewport` re-sizes before the scan (the 390 px rows); `fionaLock` marks
 * the one row that must hold the shared Fiona lock (the auth.routes
 * poisoned-password window must not overlap her sign-in).
 */
export type MatrixRow = {
  route: string
  identity: keyof typeof seedCredentials | null
  shell: 'customer' | 'staff'
  note?: string
  viewport?: { width: number; height: number }
  fionaLock?: boolean
}

/**
 * Reaches the row's authorized state and runs the axe floor.
 * The in-session customer-menu state is deliberately NOT created here —
 * the entry-gated state is what a fresh visitor reaches, and the
 * session-gated floor already rides `customer.menu.test.ts`'s pinned scan
 * (spec 025). Empty/loading states are the state the scan lands on.
 */
export async function scanMatrixRow(page: Page, row: MatrixRow): Promise<A11yViolation[]> {
  if (row.viewport) await page.setViewportSize(row.viewport)
  if (row.identity === null) {
    await page.goto(row.route)
  } else if (row.fionaLock) {
    await signInAsFiona(page, seedCredentials[row.identity])
    await page.goto(row.route)
  } else {
    await signInAs(page, seedCredentials[row.identity])
    await page.goto(row.route)
  }
  await page.waitForLoadState('networkidle')
  return expectNoNewViolations(page, { route: row.route })
}

/**
 * The shell floor (spec 035 FR-09): exactly one `#main` landmark and the
 * skip link as the FIRST thing in tab order — on whichever shell the row
 * rendered. The staff/customer shell selection itself is pinned by
 * shell.test.ts; this asserts the a11y half on every matrix page.
 */
export async function expectShellFloor(page: Page): Promise<void> {
  await expect(page.locator('#main')).toHaveCount(1)
  const skip = page.getByRole('link', { name: 'Skip to main content' })
  await expect(skip).toBeAttached()
  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
}

/** The seeded branch id used by the parameterized staff/customer rows. */
export const MATRIX_BRANCH_ID = branchIds.downtown
