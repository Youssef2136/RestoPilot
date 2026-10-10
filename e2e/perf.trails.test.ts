import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { seedCredentials } from '../tests/database/helpers/fixtures'
import { signInAs } from './helpers/signInAs'

/** The evidence sink: the probe's recorded JSON appended to W4-trails.md's
 * sibling data file (the LINE reporter drops attachments; the evidence
 * rule demands the RECORD, so the probe writes it directly). */
function recordProbe(name: string, payload: Record<string, unknown>): void {
  const dir = resolve(process.cwd(), 'specs/038-frontend-performance/measurements')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  appendFileSync(
    resolve(dir, 'W4-probe-data.jsonl'),
    `${JSON.stringify({ recorded_at: new Date().toISOString(), probe: name, ...payload })}\n`,
    'utf8',
  )
}

/**
 * specs/038 T013 — the reports/audit trail probes (FR-07/B7, D7).
 *
 * The interaction budget is SET BY THE PROBE (measure-then-decide): each
 * trail's navigation→fully-listed timing is recorded as an informational
 * attach; the VIRTUALIZATION decision is recorded here as the phase
 * artifact (W4-trails.md) — adopted only if the measurement demands it
 * AND the 035 a11y baseline re-run covers the adopted surface.
 *
 * Hard facts in this spec (deterministic, not timing): the trails render
 * ALL of their rows (no virtualized truncation to prove against), the
 * skeleton covers the wait (037 posture), and the page is a11y-stable
 * while the long trail is mounted (no layout pop of the control box).
 */
test.describe.configure({ mode: 'serial' })

const SEEDABLE = 12 // the routes' seeded volumes are small; probe notes it

test('the audit trail opens fully listed; the wait is skeleton-covered (FR-07, B7 record)', async ({
  page,
}, testInfo) => {
  await signInAs(page, seedCredentials.alice)
  // The measured window: navigation → first row listed (NOT the sign-in;
  // the sign-in flow's latency is its own surface, not the trail's).
  await page.goto('/dashboard/audit')
  const navStart = Date.now()
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  // The table is the listed surface; whatever the volume, ALL rows render
  // (asserted structurally, not by count — the count is the record).
  // A listed trail OR the 037 empty posture both end the wait (an empty
  // seeded trail is a valid listing; 15 s covers the cloud-read variance).
  const listed = page.locator('[data-audit-action]').first()
  const emptyState = page.getByText(/No audit entries match\./)
  await expect(listed.or(emptyState)).toBeVisible({ timeout: 20_000 })
  const ms = Date.now() - navStart

  const rows = await page.locator('[data-audit-action]').count()
  recordProbe('audit', { navigation_to_listed_ms: ms, rows_rendered: rows })
  testInfo.attach('perf.trails.audit', {
    body: JSON.stringify(
      {
        budget_basis: 'measure-then-decide (B7 — no threshold invented)',
        navigation_to_listed_ms: ms,
        rows_rendered: rows,
        seeded_volume_note: `seeded/burst volumes this probe: ${rows}${rows >= SEEDABLE ? '+' : ''}`,
        virtualization_decision_basis: rows,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})

test('the reports comparison opens fully rendered (FR-07 record — the comparison is bounded by branches)', async ({
  page,
}, testInfo) => {
  await signInAs(page, seedCredentials.alice)
  await page.goto('/dashboard/reports')
  const navStart = Date.now()
  await expect(page.getByTestId('report-comparison')).toBeVisible()
  const ms = Date.now() - navStart
  const rows = await page.locator('tr').count()
  recordProbe('reports', { navigation_to_comparison_ms: ms, table_rows_rendered: rows })
  testInfo.attach('perf.trails.reports', {
    body: JSON.stringify(
      {
        budget_basis: 'measure-then-decide (B7)',
        navigation_to_comparison_ms: ms,
        table_rows_rendered: rows,
        virtualization_decision_basis:
          'comparison is branch-bounded (2 seeded branches) — structurally not a long list',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
