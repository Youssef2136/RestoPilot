import { useState, type FormEvent } from 'react'
import { PRICE_HINT, canonicalizePrice, formatPrice } from '../money'
import { menuClient, type MenuItemExtraRow, type MenuItemRow } from '../menuClient'
import { useMenuInvalidation } from '../useMenu'
import { ExtrasEditor } from './ExtrasEditor'
import { ItemImageField } from './ItemImageField'
import styles from './menu.surfaces.module.css'

/**
 * One item's details (contracts/menu-client.md §5 flows 1–2; spec 005 US3,
 * FR-007/FR-010/FR-016).
 *
 * The price is handled as an exact decimal STRING end to end: the field is
 * validated against the documented shape, canonicalised to two decimals, and
 * sent as that string — no floating-point value is ever produced, so a price
 * cannot drift through the UI (research.md §9).
 *
 * An unchanged save is allowed and the server writes nothing for it
 * (FR-016); the editor says so rather than implying a change happened. Every
 * rejection message is the server's, shown verbatim next to the field
 * (contract §1) — the client never pre-empts the database's rules.
 *
 * Mounted inside the owner's menu management surface; the RPC authorizes the
 * caller regardless (Constitution IV).
 *
 * The editor also hosts the item's extras block (US4): `item` arrives as a
 * `MenuItemNode` carrying its extras, so `ExtrasEditor` is fed from the same
 * read without a second fetch.
 */

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

export function MenuItemEditor({
  restaurantId,
  item,
  onDone,
}: {
  restaurantId: string
  item: MenuItemRow & { extras?: MenuItemExtraRow[] }
  onDone?: () => void
}) {
  const invalidate = useMenuInvalidation()
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const canonical = canonicalizePrice(price)
    if (canonical === null) {
      setFeedback({ tone: 'error', message: PRICE_HINT })
      return
    }
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.updateItem({
      itemId: item.id,
      name,
      description,
      price: canonical,
    })
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }

    // The server writes nothing when every field already matches, so the
    // editor must not claim a change either.
    const changed =
      result.data.name !== item.name ||
      (result.data.description ?? '') !== (item.description ?? '') ||
      Number(result.data.price) !== Number(item.price)

    invalidate(restaurantId)
    if (!changed) {
      setFeedback({ tone: 'success', message: 'No changes to save.' })
      return
    }
    setFeedback({ tone: 'success', message: `"${result.data.name}" updated.` })
    // The editor STAYS OPEN on a changed save (spec 027: the flow continues —
    // extras/image work follows); the Close button below is the dismissal.
  }

  // The wrapper is a <section>, NOT a <form>: the extras and image blocks
  // below host their own <form>s (the add-extra and upload controls), and a
  // form inside a form is invalid HTML — the browser would drop the inner
  // element from the parse and every nested submit would break (the React
  // DOM warning names it). The item's own save is a real <form> below; the
  // section keeps the editor's accessible name (spec 027 T005).
  return (
    <section aria-label={`Edit ${item.name}`} className={styles.editorSection}>
      <form onSubmit={save} aria-label={`Item details for ${item.name}`}>
        <div className={styles.editorField}>
          <label htmlFor={`item-name-${item.id}`}>Name</label>
          <input
            id={`item-name-${item.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.editorField}>
          <label htmlFor={`item-description-${item.id}`}>Description (optional)</label>
          <input
            id={`item-description-${item.id}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className={styles.editorField}>
          <label htmlFor={`item-price-${item.id}`}>Price</label>
          <input
            id={`item-price-${item.id}`}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
          <p className={styles.hintText}>{`${PRICE_HINT} Currently ${formatPrice(item.price)}.`}</p>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save item'}
        </button>
        {onDone !== undefined && (
          <button type="button" onClick={onDone} disabled={busy}>
            Close
          </button>
        )}
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </form>

      {/* US4: this item's extras (add / edit / retire), from the same menu
          tree — their rows carry item_id, so the flat list is already this
          item's scope. */}
      <ExtrasEditor
        restaurantId={restaurantId}
        itemId={item.id}
        itemName={item.name}
        extras={item.extras ?? []}
      />

      {/* US5: the item's image field — upload → record → delete-old, signed-URL
          display. Invalidated with the same menu surface as the rest. */}
      <ItemImageField restaurantId={restaurantId} itemId={item.id} imagePath={item.image_path} />
    </section>
  )
}
