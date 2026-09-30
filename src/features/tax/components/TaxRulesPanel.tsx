import { useMemo, useState, type FormEvent } from 'react'
import { taxClient } from '../taxClient'
import { canonicalizeRate, formatRate, isValidRateInput, RATE_HINT } from '../taxMoney'
import { useTaxInvalidation, type TaxRuleInventory, type TaxRuleNode } from '../useTax'
import styles from './tax.surfaces.module.css'

/**
 * The tax rule configuration panel (contracts/tax-client.md §3 flow 1, §4;
 * spec 006 US1): the restaurant's rules in their explicit `(sort_order, name)`
 * order with scope badges, effective rates, active/retired state, and
 * compound-source labels; create and edit forms that validate the rate against
 * `RATE_PATTERN` before submit; reordering by submitting the complete ordered
 * list; retirement with a confirmation naming the rule; delete offered only
 * for rules the read marks unreferenced. Server messages surface next to the
 * control that produced them, verbatim.
 *
 * Every write here is presentation: the RPCs authorize their callers and
 * remain the boundary (Constitution IV). No optimistic values — the list
 * re-renders from the invalidated read.
 */

export interface TaxTargetOptions {
  /** The restaurant's categories (id + name) for target pickers. */
  categories: Array<{ id: string; name: string }>
  /** The restaurant's items (id + name) for target pickers. */
  items: Array<{ id: string; name: string }>
}

interface PanelProps {
  restaurantId: string
  inventory: TaxRuleInventory
  targets: TaxTargetOptions
}

const SCOPES: Array<'total' | 'items' | 'categories'> = ['total', 'items', 'categories']

function scopeBadge(scope: string): string {
  if (scope === 'total') {
    return 'Total'
  }
  if (scope === 'items') {
    return 'Items'
  }
  return 'Categories'
}

/** Shared field set for create and edit. */
function RuleFields(props: {
  name: string
  rate: string
  scope: 'total' | 'items' | 'categories'
  targetIds: string[]
  sourceIds: string[]
  targets: TaxTargetOptions
  sourceOptions: TaxRuleNode[]
  busy: boolean
  onName: (value: string) => void
  onRate: (value: string) => void
  onScope: (value: 'total' | 'items' | 'categories') => void
  onToggleTarget: (id: string) => void
  onToggleSource: (id: string) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  /** The current validation/refusal message, rendered as the error summary. */
  errorMessage?: string | null
}) {
  const {
    name,
    rate,
    scope,
    targetIds,
    sourceIds,
    targets,
    sourceOptions,
    busy,
    onName,
    onRate,
    onScope,
    onToggleTarget,
    onToggleSource,
    onSubmit,
    onCancel,
    submitLabel,
  } = props

  const rateAcceptable = rate.trim() === '' || isValidRateInput(rate)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  // The rate hint rides `aria-describedby` (the a11y requirement): the input
  // is ALWAYS described by it — the pre-submit validity just toggles its
  // emphasis; the server's validation messages surface verbatim above.
  const rateHintId = `rule-rate-hint-${name.length}-${rate.length}`

  return (
    <form onSubmit={handleSubmit} noValidate>
      {(props.errorMessage ?? null) !== null && (
        <p className={styles.errorSummary} role="alert">
          {props.errorMessage}
        </p>
      )}
      <div className={styles.fieldGroup}>
        <label htmlFor={`rule-name-${name.length}-${rate.length}`}>Name</label>
        <input
          id={`rule-name-${name.length}-${rate.length}`}
          value={name}
          onChange={(event) => onName(event.target.value)}
          disabled={busy}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor={`rule-rate-${name.length}-${rate.length}`}>Rate (%)</label>
        <input
          id={`rule-rate-${name.length}-${rate.length}`}
          value={rate}
          onChange={(event) => onRate(event.target.value)}
          disabled={busy}
          aria-invalid={!rateAcceptable}
          aria-describedby={rateHintId}
        />
        <p id={rateHintId} className={styles.hintText}>
          {RATE_HINT}
        </p>
      </div>
      <div>
        <label htmlFor={`rule-scope-${name.length}-${rate.length}`}>Scope</label>
        <select
          id={`rule-scope-${name.length}-${rate.length}`}
          value={scope}
          onChange={(event) => onScope(event.target.value as 'total' | 'items' | 'categories')}
          disabled={busy}
        >
          {SCOPES.map((option) => (
            <option key={option} value={option}>
              {scopeBadge(option)}
            </option>
          ))}
        </select>
      </div>

      {/* The multi-select target pickers are the documented <768px boundary
          (spec 028): hidden same-DOM with the guidance note replacing them —
          the phase-07 pattern (CSS only, no JS branch). */}
      {scope === 'items' && (
        <div className={styles.pickerBlock}>
          <fieldset className={styles.editorFieldset}>
            <legend>Items</legend>
            {targets.items.length === 0 && <p>This restaurant has no menu items yet.</p>}
            {targets.items.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={targetIds.includes(item.id)}
                  onChange={() => onToggleTarget(item.id)}
                  disabled={busy}
                />{' '}
                {item.name}
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {scope === 'categories' && (
        <div className={styles.pickerBlock}>
          <fieldset className={styles.editorFieldset}>
            <legend>Categories</legend>
            {targets.categories.length === 0 && <p>This restaurant has no categories yet.</p>}
            {targets.categories.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={targetIds.includes(category.id)}
                  onChange={() => onToggleTarget(category.id)}
                  disabled={busy}
                />{' '}
                {category.name}
              </label>
            ))}
          </fieldset>
        </div>
      )}

      <div className={styles.pickerBlock}>
        <fieldset className={styles.editorFieldset}>
          <legend>Compounds on (applied earlier)</legend>
          {sourceOptions.filter((rule) => rule.id).length === 0 && (
            <p>No active restaurant-level rules to compound on.</p>
          )}{' '}
          {sourceOptions
            .filter((rule) => rule.branch_id === null)
            .map((rule) => (
              <label key={rule.id}>
                <input
                  type="checkbox"
                  checked={sourceIds.includes(rule.id)}
                  onChange={() => onToggleSource(rule.id)}
                  disabled={busy}
                />{' '}
                {rule.name}
              </label>
            ))}
        </fieldset>
      </div>
      <p className={styles.pickerBoundaryNote} role="note">
        Target and compound pickers need a wider screen — set them on a tablet or desktop.
      </p>

      <button type="submit" disabled={busy || !rateAcceptable || name.trim() === ''}>
        {busy ? 'Saving…' : submitLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  )
}

export function TaxRulesPanel({ restaurantId, inventory, targets }: PanelProps) {
  const invalidate = useTaxInvalidation()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'idle' | 'creating' | { editing: string }>('idle')
  const [notice, setNotice] = useState<string | null>(null)

  // Draft state for create and edit forms.
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [scope, setScope] = useState<'total' | 'items' | 'categories'>('total')
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [sourceIds, setSourceIds] = useState<string[]>([])
  const [confirmingRetire, setConfirmingRetire] = useState<string | null>(null)

  const rules = inventory.rules
  const namesById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.name])), [rules])
  const itemNamesById = useMemo(
    () => new Map(targets.items.map((item) => [item.id, item.name])),
    [targets.items],
  )
  const categoryNamesById = useMemo(
    () => new Map(targets.categories.map((category) => [category.id, category.name])),
    [targets.categories],
  )

  /**
   * A rule is deletable exactly when the SERVER would accept it: no
   * overrides, no junction targets, no INCOMING compound references, and no
   * recorded snapshot binding its id. Outgoing citations (this rule's own
   * compoundSourceIds) do NOT block deletion — the junction rows die with it
   * (delete_unused_tax_rule's contract; the old client check wrongly counted
   * them, hiding the Delete button on compound rules).
   */
  function isUnreferenced(rule: TaxRuleNode): boolean {
    const compoundedOn = rules.some((other) => other.compoundSourceIds.includes(rule.id))
    return rule.itemIds.length === 0 && rule.categoryIds.length === 0 && !compoundedOn
  }

  function resetForm() {
    setName('')
    setRate('')
    setScope('total')
    setTargetIds([])
    setSourceIds([])
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
    // Hold busy through the invalidate → refetch round trip so the list
    // re-renders the SAVED state before the controls re-enable (027 D8).
    await invalidate(restaurantId)
    setBusy(false)
    return true
  }

  async function handleCreate() {
    const canonical = canonicalizeRate(rate)
    if (canonical === null) {
      setNotice(RATE_HINT)
      return
    }
    const saved = await run(() =>
      taxClient.createRule({
        restaurantId,
        name: name.trim(),
        rate: canonical,
        scope,
        itemIds: scope === 'items' ? targetIds : undefined,
        categoryIds: scope === 'categories' ? targetIds : undefined,
        compoundSourceIds: sourceIds.length > 0 ? sourceIds : undefined,
      }),
    )
    if (saved) {
      resetForm()
      setMode('idle')
    }
  }

  function startEditing(rule: TaxRuleNode) {
    setMode({ editing: rule.id })
    setName(rule.name)
    // The table read delivers `numeric` as a JSON number; the form edits the
    // canonical four-decimal string, which canonicalizeRate rebuilds on save.
    setRate(String(rule.rate))
    setScope(rule.scope as 'total' | 'items' | 'categories')
    setTargetIds(rule.scope === 'items' ? [...rule.itemIds] : [...rule.categoryIds])
    setSourceIds([...rule.compoundSourceIds])
    setNotice(null)
  }

  async function handleUpdate(ruleId: string) {
    const canonical = canonicalizeRate(rate)
    if (canonical === null) {
      setNotice(RATE_HINT)
      return
    }
    const saved = await run(() =>
      taxClient.updateRule({
        ruleId,
        name: name.trim(),
        rate: canonical,
        scope,
        sortOrder: rules.find((rule) => rule.id === ruleId)?.sort_order ?? 0,
        itemIds: scope === 'items' ? targetIds : [],
        categoryIds: scope === 'categories' ? targetIds : [],
        compoundSourceIds: sourceIds,
      }),
    )
    if (saved) {
      resetForm()
      setMode('idle')
    }
  }

  /**
   * Submit the complete ordered list with this rule moved one position.
   *
   * The reorder RPC validates the list against ONE context (`branch_id is
   * not distinct from` the addressed context — the count check counts that
   * context's rules only), so the restaurant list and each branch-only list
   * reorder SEPARATELY: submitting the displayed (interleaved) list is
   * refused with 'The reorder list must contain every rule of the context
   * exactly once.' — the real bug this phase's E2E caught. The swap therefore
   * happens within the moved rule's own context and submits ONLY that
   * context's ids; the displayed order (a (sort_order, name) merge across
   * contexts) shifts accordingly.
   */
  async function handleReorder(ruleId: string, direction: -1 | 1) {
    const moved = rules.find((rule) => rule.id === ruleId)
    if (moved === undefined) {
      return
    }
    const contextRules = rules.filter((rule) => rule.branch_id === moved.branch_id)
    const index = contextRules.findIndex((rule) => rule.id === ruleId)
    const swapWith = index + direction
    if (index < 0 || swapWith < 0 || swapWith >= contextRules.length) {
      return // already at the context edge
    }
    const next = [...contextRules]
    const movedNode = next[index] as TaxRuleNode
    next[index] = next[swapWith] as TaxRuleNode
    next[swapWith] = movedNode
    await run(() =>
      taxClient.reorderRules(
        restaurantId,
        next.map((rule) => rule.id),
      ),
    )
  }

  async function handleRetire(ruleId: string, isActive: boolean) {
    const saved = await run(() => taxClient.setRuleActive(ruleId, isActive))
    if (saved) {
      setConfirmingRetire(null)
    }
  }

  async function handleDelete(ruleId: string) {
    const saved = await run(() => taxClient.deleteUnusedRule(ruleId))
    if (saved) {
      setMode('idle')
    }
  }

  return (
    <section aria-labelledby="tax-rules-heading">
      <h2 id="tax-rules-heading">Tax rules</h2>
      <p>
        The order below is the order taxes apply in — each compound rule calculates after the rules
        it names. Retiring a rule stops applying it to new calculations; it stays listed.
      </p>

      {notice !== null && <p role="alert">{notice}</p>}

      {rules.length === 0 && mode === 'idle' && (
        <p>No tax rules yet. Add the first rule to start charging tax.</p>
      )}

      <ol className={styles.ruleList}>
        {rules.map((rule, index) => (
          <li key={rule.id} className={styles.ruleRow}>
            <strong className={styles.ruleName}>{rule.name}</strong> — {formatRate(rule.rate)}{' '}
            <span>({scopeBadge(rule.scope)})</span>{' '}
            {rule.branch_id !== null && <span>(branch-only)</span>}
            {rule.is_active ? (
              <span className={styles.pillActive}>Active</span>
            ) : (
              <span className={styles.pillRetired}>Retired</span>
            )}
            {rule.compoundSourceIds.length > 0 && (
              <span className={styles.ruleMeta}>
                {' '}
                — compounds on{' '}
                {rule.compoundSourceIds
                  .map((sourceId) => namesById.get(sourceId) ?? 'unknown rule')
                  .join(', ')}{' '}
                (calculated after{' '}
                {rule.compoundSourceIds
                  .map((sourceId) => namesById.get(sourceId) ?? 'unknown rule')
                  .join(', ')
                  .toLowerCase()}
                )
              </span>
            )}
            {rule.scope === 'items' && rule.itemIds.length > 0 && (
              <span>
                {' '}
                — on{' '}
                {rule.itemIds
                  .map((itemId) => itemNamesById.get(itemId) ?? 'unknown item')
                  .join(', ')}
              </span>
            )}
            {rule.scope === 'categories' && rule.categoryIds.length > 0 && (
              <span>
                {' '}
                — on{' '}
                {rule.categoryIds
                  .map((categoryId) => categoryNamesById.get(categoryId) ?? 'unknown category')
                  .join(', ')}
              </span>
            )}
            {mode !== 'creating' && (
              <span className={styles.ruleActions}>
                <button
                  type="button"
                  onClick={() => handleReorder(rule.id, -1)}
                  disabled={busy || index === 0}
                  aria-label={`Move ${rule.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(rule.id, 1)}
                  disabled={busy || index === rules.length - 1}
                  aria-label={`Move ${rule.name} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => startEditing(rule)}
                  disabled={busy}
                  aria-label={`Edit ${rule.name}`}
                >
                  Edit
                </button>
                {rule.is_active ? (
                  confirmingRetire === rule.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRetire(rule.id, false)}
                        disabled={busy}
                      >
                        Confirm retiring {rule.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRetire(null)}
                        disabled={busy}
                      >
                        Keep it
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRetire(rule.id)}
                      disabled={busy}
                      aria-label={`Retire ${rule.name}`}
                    >
                      Retire
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRetire(rule.id, true)}
                    disabled={busy}
                    aria-label={`Reactivate ${rule.name}`}
                  >
                    Reactivate
                  </button>
                )}
                {isUnreferenced(rule) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(rule.id)}
                    disabled={busy}
                    aria-label={`Delete ${rule.name}`}
                  >
                    Delete
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>

      {mode === 'creating' ? (
        <RuleFields
          name={name}
          rate={rate}
          scope={scope}
          targetIds={targetIds}
          sourceIds={sourceIds}
          targets={targets}
          sourceOptions={rules.filter((rule) => rule.is_active)}
          busy={busy}
          errorMessage={notice}
          onName={setName}
          onRate={setRate}
          onScope={(value) => {
            setScope(value)
            setTargetIds([])
          }}
          onToggleTarget={(id) =>
            setTargetIds((current) =>
              current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
            )
          }
          onToggleSource={(id) =>
            setSourceIds((current) =>
              current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
            )
          }
          onSubmit={handleCreate}
          onCancel={() => {
            resetForm()
            setMode('idle')
          }}
          submitLabel="Add rule"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            resetForm()
            setMode('creating')
          }}
          disabled={busy}
        >
          Add a tax rule
        </button>
      )}

      {typeof mode === 'object' && 'editing' in mode && (
        <section aria-label="Edit tax rule">
          <h3>Edit tax rule</h3>
          <RuleFields
            name={name}
            rate={rate}
            scope={scope}
            targetIds={targetIds}
            sourceIds={sourceIds}
            targets={targets}
            sourceOptions={rules.filter((rule) => rule.is_active && rule.id !== mode.editing)}
            busy={busy}
            errorMessage={notice}
            onName={setName}
            onRate={setRate}
            onScope={(value) => {
              setScope(value)
              setTargetIds([])
            }}
            onToggleTarget={(id) =>
              setTargetIds((current) =>
                current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
              )
            }
            onToggleSource={(id) =>
              setSourceIds((current) =>
                current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
              )
            }
            onSubmit={() => handleUpdate(mode.editing)}
            onCancel={() => {
              resetForm()
              setMode('idle')
            }}
            submitLabel="Save changes"
          />
        </section>
      )}
    </section>
  )
}
