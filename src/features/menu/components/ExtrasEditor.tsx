import { useState, type FormEvent } from 'react'
import { PRICE_HINT, canonicalizePrice, formatAdjustment } from '../money'
import { menuClient, type MenuItemExtraRow } from '../menuClient'
import { useMenuInvalidation } from '../useMenu'

/**
 * One item's structured extras (contracts/menu-client.md §5 flow 4; spec 005
 * US4, FR-018–FR-020): add, edit, and retire the flat, item-scoped extras
 * list. Extras belong to exactly one item — this editor manages only the
 * extras of the item it is mounted for, and the server (the composite FK plus
 * the owner-only RPCs) is what makes the isolation real (Constitution IV).
 *
 * The adjustment is handled as an exact decimal STRING (money.ts): an empty
 * field means the free extra (`0.00`), and a filled field must match the
 * documented shape or it is not sent at all. The 20-per-item bound is the
 * server's — the surface never counts or pre-empts it; the server's message
 * is what appears (FR-019). Retiring is a remove, not an edit: recorded
 * orders keep the extras they captured (FR-020).
 *
 * Mounted inside the owner's item editor; the RPCs authorize the caller
 * regardless.
 */

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

function ExtraRow({
  restaurantId,
  itemName,
  extra,
}: {
  restaurantId: string
  itemName: string
  extra: MenuItemExtraRow
}) {
  const invalidate = useMenuInvalidation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(extra.name)
  const [adjustment, setAdjustment] = useState(String(extra.price_adjustment))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const canonical = canonicalizePrice(adjustment)
    if (canonical === null) {
      setFeedback({ tone: 'error', message: PRICE_HINT })
      return
    }
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.updateMenuItemExtra({
      extraId: extra.id,
      name,
      priceAdjustment: canonical,
    })
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    // The server writes nothing for an unchanged save; mirror the item
    // editor's honesty about what happened.
    const changed =
      result.data.name !== extra.name ||
      Number(result.data.price_adjustment) !== Number(extra.price_adjustment)
    setFeedback({ tone: 'success', message: changed ? 'Extra updated.' : 'No changes to save.' })
    if (changed) {
      setEditing(false)
    }
  }

  async function retire() {
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.removeMenuItemExtra(extra.id)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    // The row leaves the list on the next read; no local bookkeeping.
  }

  if (!editing) {
    return (
      <li>
        <p>
          {extra.name} — {formatAdjustment(extra.price_adjustment)}
        </p>
        <button type="button" onClick={() => setEditing(true)} disabled={busy}>
          {`Edit ${extra.name}`}
        </button>{' '}
        <button type="button" onClick={() => void retire()} disabled={busy}>
          {`Retire ${extra.name}`}
        </button>
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </li>
    )
  }

  return (
    <li>
      <form onSubmit={save} aria-label={`Edit extra of ${itemName}`}>
        <div>
          <label htmlFor={`extra-name-${extra.id}`}>Extra name</label>
          <input
            id={`extra-name-${extra.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`extra-adjustment-${extra.id}`}>Price adjustment</label>
          <input
            id={`extra-adjustment-${extra.id}`}
            inputMode="decimal"
            value={adjustment}
            onChange={(event) => setAdjustment(event.target.value)}
          />
          <p>{`${PRICE_HINT} Currently ${formatAdjustment(extra.price_adjustment)}.`}</p>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save extra'}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </form>
    </li>
  )
}

/**
 * The extras block of one item's editor. `extras` comes from the restaurant
 * menu tree (already in stored order); every mutation invalidates the whole
 * menu surface, so the editor and the branch projections re-read together.
 */
export function ExtrasEditor({
  restaurantId,
  itemId,
  itemName,
  extras,
}: {
  restaurantId: string
  itemId: string
  itemName: string
  extras: readonly MenuItemExtraRow[]
}) {
  const invalidate = useMenuInvalidation()
  const [name, setName] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function add(event: FormEvent) {
    event.preventDefault()
    // An empty adjustment is the free extra; a filled one must be an exact
    // two-decimal amount before anything is sent.
    const canonical = adjustment.trim() === '' ? '0.00' : canonicalizePrice(adjustment)
    if (canonical === null) {
      setFeedback({ tone: 'error', message: PRICE_HINT })
      return
    }
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.addMenuItemExtra({
      itemId,
      name: name.trim(),
      priceAdjustment: canonical,
    })
    setBusy(false)
    if (!result.ok) {
      // The server's message — including the 20-extras bound — verbatim.
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: `${result.data.name} added.` })
    setName('')
    setAdjustment('')
  }

  return (
    <section aria-label={`Extras for ${itemName}`}>
      <h4>Extras</h4>
      {extras.length === 0 ? (
        <p>No extras yet.</p>
      ) : (
        <ul>
          {extras.map((extra) => (
            <ExtraRow
              key={extra.id}
              restaurantId={restaurantId}
              itemName={itemName}
              extra={extra}
            />
          ))}
        </ul>
      )}
      <form onSubmit={add} aria-label={`Add an extra to ${itemName}`}>
        <div>
          <label htmlFor={`new-extra-name-${itemId}`}>Extra name</label>
          <input
            id={`new-extra-name-${itemId}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`new-extra-adjustment-${itemId}`}>Price adjustment (optional)</label>
          <input
            id={`new-extra-adjustment-${itemId}`}
            inputMode="decimal"
            value={adjustment}
            onChange={(event) => setAdjustment(event.target.value)}
          />
          <p>{PRICE_HINT}</p>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add extra'}
        </button>
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </form>
    </section>
  )
}
