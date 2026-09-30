import { useState } from 'react'
import { taxClient, type BranchTaxRule, type BranchTaxConfig } from '../taxClient'
import { canonicalizeRate, formatRate, isValidRateInput, RATE_HINT } from '../taxMoney'
import { useTaxInvalidation } from '../useTax'
import styles from './tax.surfaces.module.css'

/**
 * The branch's tax view (contracts/tax-client.md §3 flow 2; spec 006 US2):
 * the effective configuration as the database computed it — one entry per
 * applicable rule with its origin label (`restaurant` / `branch-only` /
 * `override`) — plus, within `canManageBranchTax`, the replacement-rate editor
 * per restaurant-level rule (the restaurant default is what a cleared field
 * restores) and branch-only rule management. Read-only for everyone else.
 *
 * Every write here is presentation: the RPCs authorize their callers and
 * remain the boundary (Constitution IV). No optimistic values — the panel
 * re-renders from the invalidated read.
 */

interface PanelProps {
  restaurantId: string
  config: BranchTaxConfig
  canManage: boolean
}

/**
 * The inheritance badge (spec 028 FR-05): text-bearing precedence honesty —
 * 'Overridden' marks the branch's own decision (warning tint), 'Inherited'
 * marks the restaurant default. NEVER color-only. The badge vocabulary was
 * chosen to avoid the pinned strings ('(branch override)'/'Downtown
 * surcharge') which the E2E pins as count-0 on specific pages.
 */
function InheritanceBadge({ origin }: { origin: BranchTaxRule['origin'] }) {
  if (origin === 'override') {
    return <span className={styles.badgeOverridden}>Overridden</span>
  }
  if (origin === 'branch-only') {
    return null // the '(branch-only)' text remains the distinct marker
  }
  return <span className={styles.badgeInherited}>Inherited</span>
}

/** Where an editable rule shows its rate from. */
function effectiveRateLabel(rule: BranchTaxRule): string {
  if (rule.origin === 'override') {
    return `${formatRate(rule.rate)} (branch override)`
  }
  if (rule.origin === 'branch-only') {
    return `${formatRate(rule.rate)} (branch-only)`
  }
  return formatRate(rule.rate)
}

export function BranchTaxPanel({ restaurantId, config, canManage }: PanelProps) {
  const invalidate = useTaxInvalidation()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Per-rule editor state: the open rule id and its draft rate.
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [draftRate, setDraftRate] = useState('')

  function startEditing(rule: BranchTaxRule) {
    setEditingRuleId(rule.rule_id)
    setDraftRate(rule.rate)
    setNotice(null)
  }

  function stopEditing() {
    setEditingRuleId(null)
    setDraftRate('')
    setNotice(null)
  }

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true)
    setNotice(null)
    const result = await action()
    if (!result.ok) {
      setBusy(false)
      setNotice(result.message ?? 'The change could not be saved.')
      return false
    }
    // The busy state HELDS through the invalidate → refetch round trip: the
    // panel re-renders from the freshly fetched read before the controls
    // re-enable, so a fast follow-up click can never race the saved state
    // (the 027 controlled-checkbox lesson).
    await invalidate(restaurantId)
    setBusy(false)
    return true
  }

  async function handleSaveOverride(rule: BranchTaxRule) {
    const canonical = canonicalizeRate(draftRate)
    if (canonical === null) {
      setNotice(RATE_HINT)
      return
    }
    const saved = await run(() =>
      taxClient.setBranchTaxOverride({
        branchId: config.branch.id,
        ruleId: rule.rule_id,
        rate: canonical,
      }),
    )
    if (saved) {
      stopEditing()
    }
  }

  async function handleClearOverride(rule: BranchTaxRule) {
    const saved = await run(() =>
      taxClient.setBranchTaxOverride({
        branchId: config.branch.id,
        ruleId: rule.rule_id,
        rate: null,
      }),
    )
    if (saved) {
      stopEditing()
    }
  }

  return (
    <section aria-labelledby="branch-tax-heading">
      <h2 id="branch-tax-heading">Tax configuration</h2>

      {notice !== null && <p role="alert">{notice}</p>}

      {config.rules.length === 0 && <p>No tax rules apply at this branch.</p>}

      <ol className={styles.ruleList}>
        {config.rules.map((rule) => (
          <li key={rule.rule_id} className={styles.ruleRow}>
            <strong className={styles.ruleName}>{rule.name}</strong> — {effectiveRateLabel(rule)}{' '}
            <span>
              ({rule.scope === 'total' ? 'Total' : rule.scope === 'items' ? 'Items' : 'Categories'})
            </span>{' '}
            <InheritanceBadge origin={rule.origin} />
            {/* The clearing affordance (spec 028 state matrix): an OVERRIDDEN
                rule carries 'Use restaurant default' directly — the old panel
                only offered controls while origin === 'restaurant', which
                locked an override in place with no visible way back (the gap
                this phase's badge-cycle E2E caught). */}
            {canManage && (rule.origin === 'restaurant' || rule.origin === 'override') && (
              <span>
                {' '}
                {editingRuleId === rule.rule_id ? (
                  <>
                    <label htmlFor={`override-rate-${rule.rule_id}`}>Replacement rate</label>{' '}
                    <input
                      id={`override-rate-${rule.rule_id}`}
                      value={draftRate}
                      onChange={(event) => setDraftRate(event.target.value)}
                      disabled={busy}
                      aria-invalid={!isValidRateInput(draftRate)}
                      aria-describedby={`override-hint-${rule.rule_id}`}
                    />
                    <span
                      id={`override-hint-${rule.rule_id}`}
                      className={styles.hintText}
                      role="note"
                    >
                      {RATE_HINT}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveOverride(rule)}
                      disabled={busy || !isValidRateInput(draftRate)}
                    >
                      {busy ? 'Saving…' : 'Save override'}
                    </button>
                    <button type="button" onClick={() => handleClearOverride(rule)} disabled={busy}>
                      Use restaurant default
                    </button>
                    <button type="button" onClick={stopEditing} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : rule.origin === 'override' ? (
                  <button
                    type="button"
                    onClick={() => void handleClearOverride(rule)}
                    disabled={busy}
                  >
                    Use restaurant default
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(rule)}
                    disabled={busy}
                    aria-label={`Override ${rule.name} at this branch`}
                  >
                    Override rate
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>

      {canManage && (
        <p>
          Branch-only rules are managed with the restaurant's rules on the{' '}
          <a href="/dashboard/tax">Tax</a> page — create a rule with the branch scope to add one
          here.
        </p>
      )}
    </section>
  )
}
