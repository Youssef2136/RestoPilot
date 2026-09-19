import { useState } from 'react'
import { formatAdjustment, formatPrice } from '../money'
import type { BranchMenu, BranchMenuItem } from '../menuClient'

/**
 * The branch menu projection (contracts/menu-client.md §5 flow 8; spec 005
 * FR-014/FR-015) — the exit condition's artifact: the branch's menu as
 * customers see it, with the effective availability the DATABASE computed.
 *
 * The staff view shows every item, marking the unoffered ones with the reason
 * they are missing (a restaurant-wide stop, or this branch's own override), so
 * staff can see what customers see AND why something is absent. The customer
 * view toggle narrows the same payload to `is_offered` items — the subset the
 * public customer surface will serve (feature 007).
 */

const REASON_TEXT: Record<'restaurant' | 'branch', string> = {
  restaurant: 'stopped restaurant-wide',
  branch: 'unavailable at this branch',
}

function ItemLine({ item, staffView }: { item: BranchMenuItem; staffView: boolean }) {
  return (
    <li>
      <p>
        <strong>{item.name}</strong> — {formatPrice(item.price)}
        {staffView && !item.is_offered && item.unavailable_reason !== null && (
          <> ({REASON_TEXT[item.unavailable_reason]})</>
        )}
      </p>
      {item.description !== null && <p>{item.description}</p>}
      {item.extras.length > 0 && (
        <ul>
          {item.extras.map((extra) => (
            <li key={extra.id}>
              {extra.name} — {formatAdjustment(extra.price_adjustment)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function BranchMenuPreview({ menu }: { menu: BranchMenu }) {
  const [customerView, setCustomerView] = useState(false)

  const categories = menu.categories
    .map((category) => ({
      ...category,
      items: customerView ? category.items.filter((item) => item.is_offered) : category.items,
    }))
    .filter((category) => !customerView || category.items.length > 0)

  return (
    <div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={customerView}
            onChange={(event) => setCustomerView(event.target.checked)}
          />
          {`Customer view (hide what customers will not see)`}
        </label>
        <p>
          The customer view lists exactly the items this branch offers right now: a stop
          restaurant-wide or an override at this branch removes an item from it.
        </p>
      </div>

      {categories.length === 0 ? (
        <p>Nothing is offered at this branch yet.</p>
      ) : (
        categories.map((category) => (
          <section key={category.id} aria-labelledby={`branch-menu-category-${category.id}`}>
            <h2 id={`branch-menu-category-${category.id}`}>{category.name}</h2>
            {category.description !== null && <p>{category.description}</p>}
            <ul>
              {category.items.map((item) => (
                <ItemLine key={item.id} item={item} staffView={!customerView} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
