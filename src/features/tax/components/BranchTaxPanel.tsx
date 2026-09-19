import { useState } from 'react'
import { taxClient, type BranchTaxRule, type BranchTaxConfig } from '../taxClient'
import { canonicalizeRate, formatRate, isValidRateInput, RATE_HINT } from '../taxMoney'
import { useTaxInvalidation } from '../useTax'

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
    setBusy(false)
    if (!result.ok) {
      setNotice(result.message ?? 'The change could not be saved.')
      return false
    }
    invalidate(restaurantId)
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

      <ol>
        {config.rules.map((rule) => (
          <li key={rule.rule_id}>
            <strong>{rule.name}</strong> — {effectiveRateLabel(rule)}{' '}
            <span>
              ({rule.scope === 'total' ? 'Total' : rule.scope === 'items' ? 'Items' : 'Categories'})
            </span>
            {canManage && rule.origin === 'restaurant' && (
              <span>
                {' '}
                {editingRuleId === rule.rule_id ? (
                  <>
                    <label htmlFor={`override-rate-${rule.rule_id}`}>Replacement rate</label>
                    <input
                      id={`override-rate-${rule.rule_id}`}
                      value={draftRate}
                      onChange={(event) => setDraftRate(event.target.value)}
                      disabled={busy}
                      aria-invalid={!isValidRateInput(draftRate)}
                    />
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
