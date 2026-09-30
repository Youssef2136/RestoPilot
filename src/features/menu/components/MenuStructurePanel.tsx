import { useState, type FormEvent } from 'react'
import { PRICE_HINT, canonicalizePrice, formatAdjustment, formatPrice } from '../money'
import { menuClient } from '../menuClient'
import { useItemImage } from '../useItemImage'
import {
  useMenuInvalidation,
  type MenuCategoryNode,
  type MenuItemNode,
  type MenuTree,
} from '../useMenu'
import { RestaurantAvailabilityToggle } from './AvailabilityControls'
import { MenuItemEditor } from './MenuItemEditor'
import { MenuFilter } from './MenuFilter'
import styles from './menu.surfaces.module.css'

/**
 * The restaurant's menu structure editor (contracts/menu-client.md §2/§5
 * flows 1–3; spec 005 FR-005…FR-010; spec 027 T002/T003/T004 re-skin):
 * categories with their items as dense management rows — thumbnail, price,
 * availability pills, extras preview — the create/edit affordances, the
 * search/filter, set-based reordering, item moves, and the empty-category
 * delete WITH its consequence messaging (a non-empty delete is refused by
 * the server and the refusal is rendered verbatim; nothing disappears).
 *
 * The server is the validator everywhere: rejection messages are shown
 * verbatim next to the control that caused them and nothing is changed on
 * rejection. Reordering submits the COMPLETE ordered list (the RPC rejects a
 * partial one), so the stored sequence is exactly what was submitted, via
 * keyboard-accessible Move up/down buttons (spec 027 Q1 — no drag).
 *
 * Owner-only by construction — this component is mounted inside the page's
 * `canManageRestaurant` gate, which is presentation only: the RPCs remain the
 * authorization boundary (Constitution IV).
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

/**
 * The filter's matching rule (spec 027 T004): case-insensitive substring
 * over the item's name and description (null descriptions never match).
 * Lives with the panel — MenuFilter stays a component-only module (the
 * fast-refresh contract).
 */
function itemMatchesFilter(name: string, description: string | null, filter: string) {
  const needle = filter.trim().toLowerCase()
  if (needle === '') return true
  if (name.toLowerCase().includes(needle)) return true
  return description !== null && description.toLowerCase().includes(needle)
}

/** The row's image: the signed thumbnail, or the placeholder language. */
function ItemThumb({ item }: { item: MenuItemNode }) {
  const { signedUrl, resolved } = useItemImage(item.image_path)
  if (resolved && signedUrl !== null) {
    // Decorative: the item's NAME carries the meaning (spec 027 a11y).
    return <img src={signedUrl} alt="" className={styles.imageThumb} />
  }
  return (
    <span className={styles.imagePlaceholder} aria-hidden="true">
      No image
    </span>
  )
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
    <section aria-labelledby="create-menu-category-heading" className={styles.editorPanel}>
      <h3 id="create-menu-category-heading">Add a category</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.editorField}>
          <label htmlFor="new-category-name">Category name</label>
          <input
            id="new-category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.editorField}>
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

/** The page hosts the create-category form in its own section card (T002). */
export const AddCategoryForm = CreateCategoryForm

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
      <div className={styles.editorField}>
        <label htmlFor={`new-item-name-${categoryId}`}>Item name</label>
        <input
          id={`new-item-name-${categoryId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className={styles.editorField}>
        <label htmlFor={`new-item-price-${categoryId}`}>Price</label>
        <input
          id={`new-item-price-${categoryId}`}
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <p className={styles.hintText}>{PRICE_HINT}</p>
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
    <li className={styles.itemRow}>
      <ItemThumb item={item} />
      <div className={styles.itemBody}>
        <p className={styles.itemNameLine}>
          <span className={styles.itemName}>{item.name}</span>{' '}
          <span className={styles.itemPrice}>{formatPrice(item.price)}</span>
          {item.is_available ? (
            <span className={styles.pillAvailable}>Available</span>
          ) : (
            <span className={styles.pillStopped}>Stopped</span>
          )}
          {item.unavailableBranchIds.length > 0 && (
            <span className={styles.pillOverride}>
              {item.unavailableBranchIds.length === 1
                ? '1 branch override'
                : `${item.unavailableBranchIds.length} branch overrides`}
            </span>
          )}
        </p>
        {item.description !== null && <p className={styles.itemDescription}>{item.description}</p>}
        <p className={styles.itemMeta}>
          <span className={styles.moveControls}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              aria-expanded={editing}
            >
              {`Edit ${item.name}`}
            </button>
          </span>
        </p>
        {item.extras.length > 0 && (
          <ul className={styles.extrasPreview}>
            {item.extras.map((extra) => (
              <li key={extra.id}>
                {extra.name} — {formatAdjustment(extra.price_adjustment)}
              </li>
            ))}
          </ul>
        )}{' '}
        {editing && (
          <div className={styles.editorPanel}>
            <MenuItemEditor
              restaurantId={restaurantId}
              item={item}
              onDone={() => setEditing(false)}
            />
          </div>
        )}
        <div className={styles.itemActions}>
          <div className={styles.editorField}>
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
        </div>
        {feedback !== null && (
          <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
        )}
      </div>
    </li>
  )
}

function CategoryBlock({
  category,
  categories,
  restaurantId,
  filter,
}: {
  category: MenuCategoryNode
  categories: readonly MenuCategoryNode[]
  restaurantId: string
  filter: string
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
      // The consequence message (FR-01/Q2): the server's verbatim refusal —
      // a non-empty category disappears nowhere; its items are the reason.
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
  const filteredItems = category.items.filter((item) =>
    itemMatchesFilter(item.name, item.description, filter),
  )

  return (
    <section
      id={`category-${category.id}`}
      aria-labelledby={`menu-category-${category.id}`}
      className={styles.categoryBlock}
    >
      <div className={styles.categoryHeader}>
        <h3 id={`menu-category-${category.id}`}>{category.name}</h3>
      </div>
      {category.description !== null && (
        <p className={styles.categoryDescription}>{category.description}</p>
      )}
      <p className={styles.categoryActions}>
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
          <div className={styles.editorField}>
            <label htmlFor={`category-name-${category.id}`}>Name</label>
            <input
              id={`category-name-${category.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className={styles.editorField}>
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
      ) : filteredItems.length === 0 ? (
        // The filtered-empty state (spec 027 FR-02): distinct from a truly
        // empty category so the owner can tell the two apart.
        <p className={styles.filteredEmpty}>No items match your filter.</p>
      ) : (
        <ul className={styles.itemList}>
          {filteredItems.map((item, itemIndex) => (
            <li key={item.id}>
              <p className={styles.itemActions}>
                <button
                  type="button"
                  disabled={busy || itemIndex === 0}
                  onClick={() => void reorderItem(item.id, itemIndex - 1)}
                >
                  {`Move ${item.name} up`}
                </button>
                <button
                  type="button"
                  disabled={busy || itemIndex === filteredItems.length - 1}
                  onClick={() => void reorderItem(item.id, itemIndex + 1)}
                >
                  {`Move ${item.name} down`}
                </button>
              </p>
              <ul className={styles.itemList}>
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
  const [filter, setFilter] = useState('')

  return (
    <div className={styles.structureStack}>
      <MenuFilter value={filter} onChange={setFilter} />
      {menu.categories.length === 0 ? (
        <p>This restaurant has no menu yet. Add the first category to begin.</p>
      ) : (
        menu.categories.map((category) => (
          <CategoryBlock
            key={category.id}
            category={category}
            categories={menu.categories}
            restaurantId={restaurantId}
            filter={filter}
          />
        ))
      )}
    </div>
  )
}
