import { useEffect, useState } from 'react'
import { formatAdjustment } from '../../menu/money'
import type { BranchMenuItem } from '../../menu/menuClient'
import { MoneyText } from '../../../components/money/MoneyText'
import styles from './order.surfaces.module.css'

/**
 * ItemCard (spec 025 T002/T003): the ordered-field item row — name, image
 * slot (designed absence Q4), advisory price, description, availability —
 * followed by the add controls (extras fieldset + quantity + Add to cart).
 *
 * Field order is a pinned E2E contract (session.surfaces' poisoned-cart test
 * and full-journey both scope by `li` hasText 'Item Name' then reach the
 * controls inside it): the card and the detail-sheet body are THE SAME
 * component, so the controls always exist exactly where the tests scope
 * them. Availability never hides: a not-offered item renders visibly
 * unavailable (price struck through, controls absent, reason stated) — the
 * "visible unavailability" rule.
 */
export function ItemCard({
  item,
  onAdd,
}: {
  item: BranchMenuItem
  onAdd: (itemId: string, extraIds: string[], quantity: number) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    if (announcement === null) return
    const timer = window.setTimeout(() => setAnnouncement(null), 4000)
    return () => window.clearTimeout(timer)
  }, [announcement])

  if (!item.is_offered) {
    return (
      <li className={`${styles.item} ${styles.itemUnavailable}`}>
        <div className={styles.itemHeader}>
          {item.image_path === null && <div className={styles.imageSlot} aria-hidden="true" />}
          <div>
            <p className={styles.itemName}>{item.name}</p>
            <p className={styles.itemPrice}>
              <s>
                <MoneyText value={item.price} kind="advisory" />
              </s>{' '}
              — not available here
            </p>
          </div>
        </div>
        <p className={styles.itemDescription}>
          {item.unavailable_reason === 'restaurant'
            ? 'Stopped restaurant-wide.'
            : 'Not offered at this branch.'}
        </p>
      </li>
    )
  }

  const toggleExtra = (extraId: string) => {
    setSelected((current) =>
      current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId],
    )
  }

  const handleAdd = () => {
    onAdd(item.id, selected, quantity)
    setSelected([])
    setQuantity(1)
    setAnnouncement(`${item.name} added to your cart.`)
  }

  return (
    <li className={styles.item} data-item-name={item.name}>
      <div className={styles.itemHeader}>
        {item.image_path === null && <div className={styles.imageSlot} aria-hidden="true" />}
        <div>
          <p className={styles.itemName}>{item.name}</p>
          <p className={styles.itemPrice}>
            <MoneyText value={item.price} kind="advisory" />
          </p>
        </div>
      </div>
      {item.description !== null && <p className={styles.itemDescription}>{item.description}</p>}
      <div className={styles.addControls}>
        {item.extras.length > 0 && (
          <fieldset className={styles.extrasFieldset}>
            <legend>Extras</legend>
            {item.extras.map((extra) => (
              <label key={extra.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(extra.id)}
                  onChange={() => toggleExtra(extra.id)}
                />{' '}
                {extra.name} — {formatAdjustment(extra.price_adjustment)}
              </label>
            ))}
          </fieldset>
        )}
        <label className={styles.quantityLabel}>
          Quantity{' '}
          <input
            className={styles.quantityInput}
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10)
              setQuantity(Number.isNaN(parsed) ? 1 : Math.min(99, Math.max(1, parsed)))
            }}
          />
        </label>{' '}
        <button type="button" className={styles.addButton} onClick={handleAdd}>
          Add to cart
        </button>
        <p aria-live="polite" className={styles.announcement}>
          {announcement ?? ''}
        </p>
      </div>
    </li>
  )
}
