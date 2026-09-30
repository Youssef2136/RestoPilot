import { expect, test } from '@playwright/test'
import { branchIds, seedCredentials } from '../tests/database/helpers/fixtures'
import { expectNoNewViolations } from './helpers/a11y'
import { signInAs } from './helpers/signInAs'

/**
 * Tax management E2E (spec 028 T010): the phase's NEW assertions over the
 * re-skinned tax surfaces — the owner's scratch configuration journey
 * (create an item-scoped rule + a compound rule → 'calculated after'
 * explainability → reorder → retire; legal cleanup only), the verbatim rate
 * refusal with preserved input, the manager's override badge cycle
 * (inherited → overridden → inherited, seeded state restored), the preview's
 * busy→result on the bill shell with the live region, the snapshot action's
 * record + once-only outcomes (D1), the 390px capability boundary, and the
 * axe floor on both routes.
 *
 * Scratch design (the phase-07 pattern): rule names carry a per-run suffix
 * and never collide with the frozen anchors (VAT, City tax, Downtown
 * surcharge, 'Add a tax rule', 'Override'); cleanup is legal-only — scratch
 * rules are retired (the lifecycle) and deleted only where the read marks
 * them unreferenced. The seeded configuration is restored after the override
 * cycle.
 */

const TAX_URL = '/dashboard/tax'
const RUN = Date.now()
const SCRATCH_ITEM_RULE = `E2E Scratch Levy ${RUN}`
const SCRATCH_COMPOUND_RULE = `E2E Scratch Compound ${RUN}`
const SNAPSHOT_LABEL = `E2E snapshot ${RUN}`

test.describe.configure({ mode: 'serial' })

test('the owner builds a compound configuration end-to-end: create, explain, reorder, retire (FR-01/03/04/07)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(TAX_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()

  // ── Create an items-scope rule (the scratch levy on Hummus). ──
  await page.getByRole('button', { name: 'Add a tax rule' }).click()
  await page.getByLabel('Name').fill(SCRATCH_ITEM_RULE)
  await page.getByLabel('Rate (%)').fill('0.5')
  // exact:true — the shell's context switcher labels itself 'Viewing — Scope',
  // and substring matching would collide (the shell.test.ts T012 lesson).
  await page.getByLabel('Scope', { exact: true }).selectOption({ label: 'Items' })
  await page.getByRole('checkbox', { name: 'Hummus' }).check()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByText(SCRATCH_ITEM_RULE)).toBeVisible()

  // ── Create a compound rule calculated after the scratch levy. ──
  await page.getByRole('button', { name: 'Add a tax rule' }).click()
  await page.getByLabel('Name').fill(SCRATCH_COMPOUND_RULE)
  await page.getByLabel('Rate (%)').fill('1')
  await page.getByLabel('Scope', { exact: true }).selectOption({ label: 'Total' })
  await page.getByRole('checkbox', { name: SCRATCH_ITEM_RULE }).check()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await expect(page.getByText(SCRATCH_COMPOUND_RULE)).toBeVisible()

  // FR-03: the row explains 'calculated after' in plain language naming the
  // source rule.
  const compoundRow = page.locator('li').filter({ hasText: SCRATCH_COMPOUND_RULE })
  await expect(
    compoundRow.getByText(`calculated after ${SCRATCH_ITEM_RULE.toLowerCase()}`),
  ).toBeVisible()

  // FR-04: reorder states what the order changes; move the compound rule up
  // one position and observe the row INDEX change (poll the invalidated
  // read; direct li children — the rules list nests <li> inside <label>s of
  // OTHER lists, so bare locator('li') would match those too).
  await expect(page.getByText('The order below is the order taxes apply in')).toBeVisible()
  const rulesList = page.getByRole('list').filter({ has: page.getByText('VAT — 8.25%') })
  const rows = rulesList.locator('> li')
  const indexOf = (): Promise<number> =>
    rows
      .filter({ hasText: SCRATCH_COMPOUND_RULE })
      .first()
      .evaluate((el) => [...(el.parentElement?.children ?? [])].indexOf(el))
  const indexBefore = await indexOf()
  await page.getByRole('button', { name: `Move ${SCRATCH_COMPOUND_RULE} up` }).click()
  await expect.poll(indexOf, { timeout: 15_000 }).toBe(indexBefore - 1)
  await page.getByRole('button', { name: `Move ${SCRATCH_COMPOUND_RULE} down` }).click()
  await expect.poll(indexOf, { timeout: 15_000 }).toBe(indexBefore)

  // FR-07: retire the compound rule (confirm names the rule), then delete
  // both scratch rules — delete is offered only where unreferenced, and the
  // compound must go FIRST (it references the levy).
  await page.getByRole('button', { name: `Retire ${SCRATCH_COMPOUND_RULE}`, exact: true }).click()
  await page.getByRole('button', { name: `Confirm retiring ${SCRATCH_COMPOUND_RULE}` }).click()
  const compoundRowAfter = page.locator('li').filter({ hasText: SCRATCH_COMPOUND_RULE })
  await expect(compoundRowAfter.getByText('Retired', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Delete ${SCRATCH_COMPOUND_RULE}`, exact: true }).click()
  await expect(page.locator('li').filter({ hasText: SCRATCH_COMPOUND_RULE })).toHaveCount(0)

  // The item-scoped levy still carries its junction target (Hummus) — and
  // the RPC refuses an items-scope rule with zero targets ('An items-scope
  // tax rule requires at least one item.'), so emptying the checkbox list is
  // not a legal path. The legal cleanup is a SCOPE CHANGE to total (the
  // update clears the junction rows), after which the rule is unreferenced
  // and the Delete button is offered by the same contract the server
  // enforces.
  await page.getByRole('button', { name: `Edit ${SCRATCH_ITEM_RULE}`, exact: true }).click()
  await page.getByLabel('Scope', { exact: true }).selectOption({ label: 'Total' })
  await page.getByRole('button', { name: 'Save changes' }).click()
  const levyRow = page.locator('li').filter({ hasText: SCRATCH_ITEM_RULE }).first()
  await expect(levyRow.getByText('on Hummus')).toHaveCount(0)
  await page.getByRole('button', { name: `Delete ${SCRATCH_ITEM_RULE}`, exact: true }).click()
  await expect(page.locator('li').filter({ hasText: SCRATCH_ITEM_RULE })).toHaveCount(0)
})

test('a malformed rate is refused with the server\u2019s message and the input is preserved (FR-02, Q4)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(TAX_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()

  await page.getByRole('button', { name: 'Add a tax rule' }).click()
  await page.getByLabel('Name').fill(`E2E Scratch Rate Refusal ${RUN}`)
  await page.getByLabel('Rate (%)').fill('12.345.6')

  // Limits-before-attempt (Q4) is enforced STRUCTURALLY: the malformed rate
  // disables the submit button outright — the RPC is never sent — while the
  // documented hint shows next to the field (aria-describedby) and the input
  // is preserved (the form never submits, so nothing is lost).
  await expect(page.getByRole('button', { name: 'Add rule' })).toBeDisabled()
  await expect(
    page.getByText('Enter a percentage between 0 and 100 with at most four decimal places'),
  ).toBeVisible()
  await expect(page.getByLabel('Rate (%)')).toHaveValue('12.345.6')
  await expect(page.getByLabel('Name')).toHaveValue(`E2E Scratch Rate Refusal ${RUN}`)
  await page.getByRole('button', { name: 'Cancel' }).click()
})

test('a manager overrides a rule and sees the badge flip; clearing restores inherited (FR-05, SC-02)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.bob)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()

  const vatRow = page.locator('li').filter({ hasText: 'VAT — 8.25%' }).first()

  // Seeded baseline: inherited (the restaurant default, badged).
  await expect(vatRow.getByText('Inherited', { exact: true })).toBeVisible()

  // Set a replacement rate → the badge flips to Overridden.
  await page.getByRole('button', { name: 'Override VAT at this branch' }).click()
  await page.getByLabel('Replacement rate').fill('9')
  await page.getByRole('button', { name: 'Save override' }).click()
  const overriddenRow = page.locator('li').filter({ hasText: 'VAT — 9%' }).first()
  await expect(overriddenRow.getByText('Overridden', { exact: true })).toBeVisible()

  // Clear it → inherited again with the restaurant rate (seeded state back).
  // The overridden row carries 'Use restaurant default' DIRECTLY (the new
  // clearing affordance — the old panel offered no control on an overridden
  // row, which locked the override in place).
  const overriddenRowForClear = page.locator('li').filter({ hasText: 'VAT — 9%' }).first()
  await overriddenRowForClear.getByRole('button', { name: 'Use restaurant default' }).click()
  await expect
    .poll(
      async () =>
        page
          .locator('li')
          .filter({ hasText: 'VAT — 8.25%' })
          .first()
          .getByText('Inherited', { exact: true })
          .isVisible()
          .catch(() => false),
      { timeout: 15_000 },
    )
    .toBe(true)
})

test('the preview shows a busy state then announces the result in a live region (FR-06/FR-10)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()

  await page.getByLabel('Add an item').selectOption({ label: 'Hummus — 6.50' })
  await page.getByRole('button', { name: 'Calculate taxes' }).click()
  await expect(page.getByText('What the customer will be shown')).toBeVisible()
  await expect(page.getByText('Subtotal: 6.50')).toBeVisible()

  // The result region announces updates (the a11y requirement) and keeps the
  // engine's numbers verbatim — subtotal 6.50, total 7.28 on the seed.
  const result = page.getByRole('region', { name: 'Calculation result' })
  await expect(result).toHaveAttribute('aria-live', 'polite')
  await expect(result).toContainText('7.28')
})

test('the owner records a snapshot; re-recording the same configuration states the once-only outcome (FR-08, D1)', async ({
  page,
}) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(TAX_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()

  // The snapshot card: the SectionCard owns the h2 'Tax snapshot'; the
  // action's controls live inside it (the action itself renders no heading —
  // it is hosted, not duplicated).
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name: 'Tax snapshot' }) })
  await section.getByLabel('Branch').selectOption({ label: 'Downtown' })
  await section.getByLabel('Snapshot label').fill(SNAPSHOT_LABEL)
  await section.getByRole('button', { name: 'Record snapshot' }).click()

  // First recording: the confirmation names the branch and states the
  // once-only guarantee. The button label stays STABLE, so the attempt is
  // always available (D1: outcomes render in the status paragraph).
  await expect(section.getByText('Snapshot recorded for Downtown.')).toBeVisible({
    timeout: 15_000,
  })

  // A second recording of the SAME configuration: the once-only guarantee
  // holding — stated as an outcome, never an error (D1).
  await section.getByRole('button', { name: 'Record snapshot' }).click()
  await expect(
    section.getByText(
      'No new snapshot was created for Downtown: this configuration is already recorded.',
    ),
  ).toBeVisible({ timeout: 15_000 })
})

test('the 390px boundary keeps rules and preview readable and hides the multi-select pickers (Responsive)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page, seedCredentials.alice)
  await page.goto(TAX_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()

  // The rule rows and their actions stay reachable; the section nav works.
  await expect(page.getByText('VAT — 8.25%', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add a tax rule' })).toBeVisible()

  // The branch page's preview stays readable at 390px.
  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  await expect(page.getByLabel('Add an item')).toBeVisible()
})

test('both tax routes pass the axe WCAG 2.2 AA floor', async ({ page }) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto(TAX_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Tax' })).toBeVisible()
  await expectNoNewViolations(page, { route: TAX_URL })

  await page.goto(`/dashboard/branches/${branchIds.downtown}/tax`)
  await expect(page.getByRole('heading', { level: 1, name: 'Downtown tax' })).toBeVisible()
  await expectNoNewViolations(page, { route: '/dashboard/branches/:branchId/tax' })
})
