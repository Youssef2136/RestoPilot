import { useMemo, useState } from 'react'
import { formatAdjustment, formatPrice } from '../../menu/money'
import type { BranchMenu } from '../../menu/menuClient'
import { loadCart, type CartLine } from '../cartState'
import { readSessionToken } from '../../session/sessionClient'
import { useCart } from '../useOrder'
import { SubmitControl } from './SubmitControl'

/**
 * The customer cart surface (spec 008 T011; contracts/order-client.md §4;
 * US1). Add-to-cart affordances live on the offered items only — the menu
 * payload's `is_offered` already encodes the two availability layers, so an
 * unavailable item never reaches the cart (the server re-checks anyway).
 *
 * The running total is ADVISORY and recomputed from the payload's prices
 * (item price + selected extra adjustments × quantity) — the submission's
 * captured money from the 006 engine is the state that matters (FR-004,
 * Constitution V). Quantity bounds (1–99) are client feedback only; the
 * server bound is authoritative.
 *
 * Submission (US2): the submit control is disabled while the cart is empty
 * or the mutation is in flight — that disabled state IS the double-submit
 * guard's client half (FR-009). A refusal renders the server's message
 * verbatim in a `role="alert"`, and the cart remains exactly as it was
 * (FR-010 — the lines state is untouched on failure).
 */

/** The client feedback bounds (the server's are authoritative). */
const MIN_QUANTITY = 1
const MAX_QUANTITY = 99

export type { CartLine }

function AddToCartControl({
  itemId,
  extras,
  onAdd,
}: {
  itemId: string
  extras: Array<{ id: string; name: string; price_adjustment: string }>
  onAdd: (itemId: string, extraIds: string[], quantity: number) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)

  const toggleExtra = (extraId: string) => {
    setSelected((current) =>
      current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId],
    )
  }

  return (
    <div>
      {extras.length > 0 && (
        <fieldset>
          <legend>Extras</legend>
          {extras.map((extra) => (
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
      <label>
        Quantity{' '}
        <input
          type="number"
          min={MIN_QUANTITY}
          max={MAX_QUANTITY}
          value={quantity}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10)
            setQuantity(
              Number.isNaN(parsed)
                ? MIN_QUANTITY
                : Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, parsed)),
            )
          }}
        />
      </label>{' '}
      <button
        type="button"
        onClick={() => {
          onAdd(itemId, selected, quantity)
          setSelected([])
          setQuantity(1)
        }}
      >
        Add to cart
      </button>
    </div>
  )
}

export function CartPanel({ menu }: { menu: BranchMenu }) {
  const { lines, update, addLine } = useCart()

  // The advisory total: recomputed from the menu payload's prices — never
  // from a previous submission's captured money (contract §2). The map also
  // carries the display names the cart lines render (items and extras).
  const itemsById = useMemo(() => {
    const map = new Map<
      string,
      {
        price: string
        name: string
        extras: Map<string, { name: string; price_adjustment: string }>
      }
    >()
    for (const category of menu.categories) {
      for (const item of category.items) {
        map.set(item.id, {
          price: item.price,
          name: item.name,
          extras: new Map(
            item.extras.map((extra) => [
              extra.id,
              { name: extra.name, price_adjustment: extra.price_adjustment },
            ]),
          ),
        })
      }
    }
    return map
  }, [menu])

  const total = useMemo(() => {
    let sum = 0
    for (const line of lines) {
      const item = itemsById.get(line.item_id)
      if (item === undefined) {
        continue
      }
      let lineTotal = Number(item.price)
      for (const extraId of line.extra_ids) {
        const extra = item.extras.get(extraId)
        if (extra !== undefined) {
          lineTotal += Number(extra.price_adjustment)
        }
      }
      sum += lineTotal * line.quantity
    }
    return sum
  }, [lines, itemsById])

  const adjustQuantity = (index: number, delta: number) => {
    const next = loadCart(readSessionToken)
    const line = next[index]
    if (line === undefined) {
      return
    }
    const quantity = line.quantity + delta
    if (quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
      return
    }
    next[index] = { ...line, quantity }
    update(next)
  }

  const removeLine = (index: number) => {
    const next = loadCart(readSessionToken).filter((_, i) => i !== index)
    update(next)
  }

  const offeredCategories = menu.categories.map((category) => ({
    ...category,
    items: category.items.filter((item) => item.is_offered),
  }))

  return (
    <section aria-label="Cart">
      <h2>Menu</h2>
      {offeredCategories.map((category) => (
        <section key={category.id}>
          <h3>{category.name}</h3>
          <ul>
            {category.items.map((item) => (
              <li key={item.id}>
                <p>
                  <strong>{item.name}</strong> — {formatPrice(item.price)}
                </p>
                {item.description !== null && <p>{item.description}</p>}
                <AddToCartControl itemId={item.id} extras={item.extras} onAdd={addLine} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>Your cart</h2>
      {lines.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <ul>
          {lines.map((line: CartLine, index: number) => {
            const item = itemsById.get(line.item_id)
            return (
              <li key={`${line.item_id}-${index}`}>
                {item?.name ?? 'Item'} × {line.quantity}
                {line.extra_ids.length > 0 && (
                  <ul>
                    {line.extra_ids.map((extraId) => {
                      const extra = item?.extras.get(extraId)
                      // An unknown extra id (stale cart) degrades to the id —
                      // never blocks the line.
                      return <li key={extraId}>{extra?.name ?? extraId}</li>
                    })}
                  </ul>
                )}
                <button type="button" onClick={() => adjustQuantity(index, 1)}>
                  +
                </button>
                <button type="button" onClick={() => adjustQuantity(index, -1)}>
                  −
                </button>
                <button type="button" onClick={() => removeLine(index)}>
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p>
        Total (before tax): <strong>{formatPrice(total)}</strong>
      </p>
      <SubmitControl lines={lines} />
    </section>
  )
}
