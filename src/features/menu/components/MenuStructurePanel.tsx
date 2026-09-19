import { useState, type FormEvent } from 'react'
import { PRICE_HINT, canonicalizePrice, formatAdjustment, formatPrice } from '../money'
import { menuClient } from '../menuClient'
import {
  useMenuInvalidation,
  type MenuCategoryNode,
  type MenuItemNode,
  type MenuTree,
} from '../useMenu'
import { RestaurantAvailabilityToggle } from './AvailabilityControls'
import { MenuItemEditor } from './MenuItemEditor'

/**
 * The restaurant's menu structure editor (contracts/menu-client.md §2/§5
 * flows 1–3; FR-005…FR-010): categories with their items, the create/edit
 * affordances, set-based reordering, item moves, and the empty-category
 * delete.
 *
 * The server is the validator everywhere: rejection messages are shown
 * verbatim next to the control that caused them and nothing is changed on
 * rejection. Reordering submits the COMPLETE ordered list (the RPC rejects a
 * partial one), so the stored sequence is exactly what was submitted.
 *
 * Owner-only by construction — this component is mounted inside the page's
 * `canManageRestaurant` gate, which is presentation only: the RPCs remain the
 * authorization boundary (Constitution IV).
 *
 * The richer per-item surface (extras, image) is a later story's component,
 * mounted from the item row in this panel.
 */

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/** Swap two neighbours in a copy of the list (the new complete order). */
function swap<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const a = next[from]
  const b = next[to]
  if (a === undefined || b === undefined) {
    return next
  }
  next[from] = b
  next[to] = a
  return next
}

function CreateCategoryForm({ restaurantId }: { restaurantId: string }) {
  const invalidate = useMenuInvalidation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await menuClient.createCategory({ restaurantId, name, description })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setName('')
    setDescription('')
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: `Category "${result.data.name}" created.` })
  }

  return (
    <section aria-labelledby="create-menu-category-heading">
      <h3 id="create-menu-category-heading">Add a category</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="new-category-name">Category name</label>
          <input
            id="new-category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new-category-description">Description (optional)</label>
          <input
            id="new-category-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}

function CreateItemForm({
  categoryId,
  restaurantId,
}: {
  categoryId: string
  restaurantId: string
}) {
  const invalidate = useMenuInvalidation()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const canonicalPrice = canonicalizePrice(price)
    if (canonicalPrice === null) {
      setFeedback({ tone: 'error', message: PRICE_HINT })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    const result = await menuClient.createItem({
      categoryId,
      name,
      price: canonicalPrice,
      description: null,
    })
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    setName('')
    setPrice('')
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: `Item "${result.data.name}" added.` })
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Add an item to this category">
      <div>
        <label htmlFor={`new-item-name-${categoryId}`}>Item name</label>
        <input
          id={`new-item-name-${categoryId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`new-item-price-${categoryId}`}>Price</label>
        <input
          id={`new-item-price-${categoryId}`}
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <p>{PRICE_HINT}</p>
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add item'}
      </button>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </form>
  )
}

function ItemRow({
  item,
  categories,
  restaurantId,
}: {
  item: MenuItemNode
  categories: readonly MenuCategoryNode[]
  restaurantId: string
}) {
  const invalidate = useMenuInvalidation()
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)

  async function moveTo(categoryId: string) {
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.moveItem(item.id, categoryId)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: `"${result.data.name}" moved.` })
  }

  return (
    <li>
      <p>
        <strong>{item.name}</strong> — {formatPrice(item.price)}
        {item.is_available ? '' : ' (stopped restaurant-wide)'}
      </p>
      {item.description !== null && <p>{item.description}</p>}
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} disabled={busy}>
          {`Edit ${item.name}`}
        </button>
      ) : (
        <MenuItemEditor restaurantId={restaurantId} item={item} onDone={() => setEditing(false)} />
      )}
      <div>
        <label htmlFor={`item-move-${item.id}`}>Move to another category</label>
        <select
          id={`item-move-${item.id}`}
          value={item.category_id}
          disabled={busy}
          onChange={(event) => void moveTo(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <RestaurantAvailabilityToggle
        restaurantId={restaurantId}
        itemId={item.id}
        itemName={item.name}
        isAvailable={item.is_available}
        canManage
      />
      {/* The item's extras (US4) are always present in read view: the owner
          sees what each item offers without opening the editor. */}
      {item.extras.length > 0 && (
        <ul>
          {item.extras.map((extra) => (
            <li key={extra.id}>
              {extra.name} — {formatAdjustment(extra.price_adjustment)}
            </li>
          ))}
        </ul>
      )}
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </li>
  )
}

function CategoryBlock({
  category,
  categories,
  restaurantId,
}: {
  category: MenuCategoryNode
  categories: readonly MenuCategoryNode[]
  restaurantId: string
}) {
  const invalidate = useMenuInvalidation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveCategory(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.updateCategory({
      categoryId: category.id,
      name,
      description,
    })
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    setEditing(false)
    setFeedback({ tone: 'success', message: `Category "${result.data.name}" updated.` })
  }

  async function reorder(to: number) {
    const ids = swap(
      categories.map((c) => c.id),
      categories.findIndex((c) => c.id === category.id),
      to,
    )
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.reorderCategories(restaurantId, ids)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
    setFeedback({ tone: 'success', message: 'Order saved.' })
  }

  async function remove() {
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.deleteCategory(category.id)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
  }

  async function reorderItem(itemId: string, to: number) {
    const ids = swap(
      category.items.map((i) => i.id),
      category.items.findIndex((i) => i.id === itemId),
      to,
    )
    setBusy(true)
    setFeedback(null)
    const result = await menuClient.reorderItems(category.id, ids)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.message })
      return
    }
    invalidate(restaurantId)
  }

  const index = categories.findIndex((c) => c.id === category.id)

  return (
    <section aria-labelledby={`menu-category-${category.id}`}>
      <h3 id={`menu-category-${category.id}`}>{category.name}</h3>
      {category.description !== null && <p>{category.description}</p>}
      <p>
        <button
          type="button"
          disabled={busy || index === 0}
          onClick={() => void reorder(index - 1)}
        >
          {`Move ${category.name} up`}
        </button>
        <button
          type="button"
          disabled={busy || index === categories.length - 1}
          onClick={() => void reorder(index + 1)}
        >
          {`Move ${category.name} down`}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {`Rename ${category.name}`}
        </button>
        <button type="button" disabled={busy} onClick={() => void remove()}>
          {`Delete ${category.name}`}
        </button>
      </p>
      {editing && (
        <form onSubmit={saveCategory} aria-label={`Edit ${category.name}`}>
          <div>
            <label htmlFor={`category-name-${category.id}`}>Name</label>
            <input
              id={`category-name-${category.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`category-description-${category.id}`}>Description (optional)</label>
            <input
              id={`category-description-${category.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save category'}
          </button>
        </form>
      )}
      {category.items.length === 0 ? (
        <p>No items in this category yet.</p>
      ) : (
        <ul>
          {category.items.map((item, itemIndex) => (
            <li key={item.id}>
              <p>
                <button
                  type="button"
                  disabled={busy || itemIndex === 0}
                  onClick={() => void reorderItem(item.id, itemIndex - 1)}
                >
                  {`Move ${item.name} up`}
                </button>
                <button
                  type="button"
                  disabled={busy || itemIndex === category.items.length - 1}
                  onClick={() => void reorderItem(item.id, itemIndex + 1)}
                >
                  {`Move ${item.name} down`}
                </button>
              </p>
              <ul>
                <ItemRow item={item} categories={categories} restaurantId={restaurantId} />
              </ul>
            </li>
          ))}
        </ul>
      )}
      <CreateItemForm categoryId={category.id} restaurantId={restaurantId} />
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}

export function MenuStructurePanel({
  restaurantId,
  menu,
}: {
  restaurantId: string
  menu: MenuTree
}) {
  return (
    <div>
      {menu.categories.length === 0 ? (
        <p>This restaurant has no menu yet. Add the first category to begin.</p>
      ) : (
        menu.categories.map((category) => (
          <CategoryBlock
            key={category.id}
            category={category}
            categories={menu.categories}
            restaurantId={restaurantId}
          />
        ))
      )}
      <CreateCategoryForm restaurantId={restaurantId} />
    </div>
  )
}
