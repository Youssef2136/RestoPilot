import { useMemo } from 'react'
import type { BranchMenu } from '../../menu/menuClient'
import { readSessionToken } from '../../session/sessionClient'
import { loadCart, type CartLine } from '../cartState'
import { useCart } from '../useOrder'
import { TotalsPanel } from '../../../components/money/TotalsPanel'
import { CutoffNotice } from './CutoffNotice'
import { SubmitBar } from './SubmitBar'
import styles from './order.surfaces.module.css'

/**
 * CartRegion (spec 025 T004/T005/T008): THE `region` named `Cart` — the
 * frozen E2E assertion scope (never renamed, never unmounted while the menu
 * is up). Desktop (≥1024px) it renders as a side panel; below that the CSS
 * presents the same DOM as a bottom sheet (Q1 — one DOM, two shells; the
 * region and its pins stay reachable in both).
 *
 * Contents: the itemized lines (adjust/remove), the ADVISORY before-tax
 * total through TotalsPanel, the CutoffNotice state (before any submit
 * attempt), and the SubmitBar (busy/disabled, verbatim refusal alert,
 * success status naming the ticket).
 */

const MIN_QUANTITY = 1
const MAX_QUANTITY = 99

export function CartRegion({ menu, channel }: { menu: BranchMenu; channel: string }) {
  const { lines, update } = useCart()

  // The payload's display map: prices, names, extras (identical shape to the
  // predecessor CartPanel — the advisory math and stale-extra degradation are
  // pinned behavior).
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

  // The ADVISORY total — recomputed from the payload's prices only; never
  // confused with the captured money the history renders (checklist).
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
    update(loadCart(readSessionToken).filter((_, i) => i !== index))
  }

  return (
    <section aria-label="Cart" className={styles.cartRegion}>
      <h2 className={styles.cartHeading}>Your cart</h2>
      {lines.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <ul className={styles.lineList}>
          {lines.map((line: CartLine, index: number) => {
            const item = itemsById.get(line.item_id)
            return (
              <li key={`${line.item_id}-${index}`} className={styles.lineItem}>
                <p>
                  {item?.name ?? 'Item'} × {line.quantity}
                </p>
                {line.extra_ids.length > 0 && (
                  <ul className={styles.lineExtras}>
                    {line.extra_ids.map((extraId) => {
                      const extra = item?.extras.get(extraId)
                      // An unknown extra id (stale cart) degrades to the id —
                      // never blocks the line (pinned degradation).
                      return <li key={extraId}>{extra?.name ?? extraId}</li>
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => adjustQuantity(index, 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => adjustQuantity(index, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => removeLine(index)}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <TotalsPanel advisoryTotal={total} />
      <CutoffNotice channel={channel} hasLines={lines.length > 0} />
      <div className={styles.cartActions}>
        <SubmitBar lines={lines} />
      </div>
    </section>
  )
}
