import { useMemo, useState, type FormEvent } from 'react'
import { taxClient } from '../taxClient'
import { canonicalizeRate, formatRate, isValidRateInput, RATE_HINT } from '../taxMoney'
import { useTaxInvalidation, type TaxRuleInventory, type TaxRuleNode } from '../useTax'

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

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor={`rule-name-${name.length}-${rate.length}`}>Name</label>
        <input
          id={`rule-name-${name.length}-${rate.length}`}
          value={name}
          onChange={(event) => onName(event.target.value)}
          disabled={busy}
        />
      </div>
      <div>
        <label htmlFor={`rule-rate-${name.length}-${rate.length}`}>Rate (%)</label>
        <input
          id={`rule-rate-${name.length}-${rate.length}`}
          value={rate}
          onChange={(event) => onRate(event.target.value)}
          disabled={busy}
          aria-invalid={!rateAcceptable}
        />
        {!rateAcceptable && <p role="note">{RATE_HINT}</p>}
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

      {scope === 'items' && (
        <fieldset>
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
      )}

      {scope === 'categories' && (
        <fieldset>
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
      )}

      <fieldset>
        <legend>Compounds on (applied earlier)</legend>
        {sourceOptions.filter((rule) => rule.id).length === 0 && (
          <p>No active restaurant-level rules to compound on.</p>
        )}
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

  /** A rule is deletable exactly when the read marks it unreferenced. */
  function isUnreferenced(rule: TaxRuleNode): boolean {
    const compoundedOn = rules.some((other) => other.compoundSourceIds.includes(rule.id))
    return (
      rule.itemIds.length === 0 &&
      rule.categoryIds.length === 0 &&
      rule.compoundSourceIds.length === 0 &&
      !compoundedOn
    )
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
    setBusy(false)
    if (!result.ok) {
      setNotice(result.message ?? 'The change could not be saved.')
      return false
    }
    invalidate(restaurantId)
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

  /** Submit the complete ordered list with this rule moved one position. */
  async function handleReorder(ruleId: string, direction: -1 | 1) {
    const index = rules.findIndex((rule) => rule.id === ruleId)
    const swapWith = index + direction
    if (index < 0 || swapWith < 0 || swapWith >= rules.length) {
      return
    }
    const next = [...rules]
    const moved = next[index] as TaxRuleNode
    next[index] = next[swapWith] as TaxRuleNode
    next[swapWith] = moved
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

      {notice !== null && <p role="alert">{notice}</p>}

      {rules.length === 0 && mode === 'idle' && (
        <p>No tax rules yet. Add the first rule to start charging tax.</p>
      )}

      <ol>
        {rules.map((rule, index) => (
          <li key={rule.id}>
            <strong>{rule.name}</strong> — {formatRate(rule.rate)}{' '}
            <span>({scopeBadge(rule.scope)})</span>{' '}
            {rule.branch_id !== null && <span>(branch-only)</span>}
            {!rule.is_active && <span> (retired)</span>}
            {rule.compoundSourceIds.length > 0 && (
              <span>
                {' '}
                — compounds on{' '}
                {rule.compoundSourceIds
                  .map((sourceId) => namesById.get(sourceId) ?? 'unknown rule')
                  .join(', ')}
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
              <span>
                {' '}
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
