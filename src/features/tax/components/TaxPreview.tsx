import { useMemo, useState } from 'react'
import type { BranchMenu, BranchMenuItem } from '../../menu/menuClient'
import { formatPrice } from '../../menu/money'
import { formatRate } from '../taxMoney'
import { useTaxPreview } from '../useTax'
import type { TaxSelection } from '../taxClient'

/**
 * The calculation preview (contracts/tax-client.md §3 flow 3; spec 006 US3):
 * pick items (with extras) into a basket, submit, and render the exact lines
 * the customer will be shown — name, rate, scope, amount — in the engine's
 * configured order, plus subtotal and total.
 *
 * Constitution V discipline: this component computes nothing. It assembles
 * the selection payload from names and checkbox state and renders the
 * engine's returned text amounts verbatim. The submission travels once per
 * button press (`useTaxPreview` runs only while `submitted` holds a basket),
 * never on keystroke.
 */

/** The scope badge text, matching the rules panel. */
function scopeBadge(scope: string): string {
  if (scope === 'total') {
    return 'Total'
  }
  if (scope === 'items') {
    return 'Items'
  }
  return 'Categories'
}

/** One editable basket row. */
interface BasketEntry {
  /** Unique per row so the same item can appear twice. */
  key: number
  item: BranchMenuItem
  /** Selected extra ids for this row. */
  extras: string[]
  quantity: number
}

export function TaxPreview({ branchId, menu }: { branchId: string; menu: BranchMenu }) {
  const [entries, setEntries] = useState<BasketEntry[]>([])
  const [submitted, setSubmitted] = useState<TaxSelection[] | null>(null)

  const offeredItems = useMemo(
    () => menu.categories.flatMap((category) => category.items.filter((item) => item.is_offered)),
    [menu],
  )
  const itemById = useMemo(
    () => new Map(offeredItems.map((item) => [item.id, item])),
    [offeredItems],
  )

  const previewQuery = useTaxPreview(branchId, submitted)

  function addEntry(item: BranchMenuItem) {
    setEntries((current) => [
      ...current,
      { key: Date.now() + current.length, item, extras: [], quantity: 1 },
    ])
  }

  function updateEntry(key: number, patch: Partial<Pick<BasketEntry, 'extras' | 'quantity'>>) {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    )
  }

  function removeEntry(key: number) {
    setEntries((current) => current.filter((entry) => entry.key !== key))
  }

  function handleSubmit() {
    const selections: TaxSelection[] = entries.map((entry) => ({
      item_id: entry.item.id,
      extras: entry.extras.map((extra_id) => ({ extra_id })),
      quantity: Math.max(1, Math.trunc(entry.quantity) || 1),
    }))
    setSubmitted(selections)
  }

  const lines = previewQuery.data?.lines ?? []

  return (
    <section aria-labelledby="tax-preview-heading">
      <h2 id="tax-preview-heading">Calculation preview</h2>
      <p>
        Build a basket and submit it to see the exact lines the customer will be shown — computed
        once per submission, never per keystroke.
      </p>

      {offeredItems.length === 0 ? (
        <p>This branch has no offered items yet, so there is nothing to preview.</p>
      ) : (
        <div>
          <label htmlFor="tax-preview-item">Add an item</label>{' '}
          <select
            id="tax-preview-item"
            value=""
            disabled={entries.length >= 20}
            onChange={(event) => {
              const item = itemById.get(event.target.value)
              if (item) {
                addEntry(item)
              }
            }}
          >
            <option value="">Choose an item…</option>
            {offeredItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {formatPrice(item.price)}
              </option>
            ))}
          </select>
        </div>
      )}

      {entries.length === 0 && (
        <p>The basket is empty; a submitted empty basket shows zero lines and no taxes.</p>
      )}

      <ol>
        {entries.map((entry) => (
          <li key={entry.key}>
            <strong>{entry.item.name}</strong> — {formatPrice(entry.item.price)}{' '}
            <label>
              Qty{' '}
              <input
                type="number"
                min={1}
                step={1}
                value={entry.quantity}
                onChange={(event) =>
                  updateEntry(entry.key, { quantity: Number(event.target.value) })
                }
                aria-label={`Quantity of ${entry.item.name}`}
              />
            </label>{' '}
            <button
              type="button"
              onClick={() => removeEntry(entry.key)}
              aria-label={`Remove ${entry.item.name}`}
            >
              Remove
            </button>
            {entry.item.extras.length > 0 && (
              <div>
                {entry.item.extras.map((extra) => (
                  <label key={extra.id}>
                    <input
                      type="checkbox"
                      checked={entry.extras.includes(extra.id)}
                      onChange={() =>
                        updateEntry(entry.key, {
                          extras: entry.extras.includes(extra.id)
                            ? entry.extras.filter((id) => id !== extra.id)
                            : [...entry.extras, extra.id],
                        })
                      }
                    />{' '}
                    {extra.name} (+{formatPrice(extra.price_adjustment)})
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <button type="button" onClick={handleSubmit} disabled={entries.length === 0}>
        Calculate taxes
      </button>

      {previewQuery.isError && (
        <p role="alert">
          {previewQuery.error instanceof Error ? previewQuery.error.message : 'Calculation failed.'}
        </p>
      )}

      {previewQuery.data !== undefined && (
        <div aria-label="Calculation result">
          <h3>What the customer will be shown</h3>
          {lines.length === 0 ? (
            <p>No taxes apply to this basket — the total equals the subtotal.</p>
          ) : (
            <table>
              <caption>Tax lines in the configured order</caption>
              <thead>
                <tr>
                  <th scope="col">Tax</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.rule_id}>
                    <td>{line.name}</td>
                    <td>{formatRate(line.rate)}</td>
                    <td>{scopeBadge(line.scope)}</td>
                    <td>{formatPrice(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p>
            Subtotal: {formatPrice(previewQuery.data.subtotal)} — Total:{' '}
            <strong>{formatPrice(previewQuery.data.total)}</strong>
          </p>
        </div>
      )}
    </section>
  )
}
