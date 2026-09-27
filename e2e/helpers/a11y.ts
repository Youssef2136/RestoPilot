import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
