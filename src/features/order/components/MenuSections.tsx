import type { BranchMenu } from '../../menu/menuClient'
import { ItemCard } from './ItemCard'
import styles from './order.surfaces.module.css'

/**
 * MenuSections (spec 025 T002; FR-02/FR-11; specs/031 FR-02, D1): one section
 * per category — the offered items as ItemCards, the unavailable ones visibly
 * unavailable, and the three empty/partial states designed: no categories at
 * all, a category with nothing offered, and (upstream) the menu-level error
 * and loading states owned by the page. The cutoff pre-emption threads
 * through: when the session's ordering is closed every add control disables
 * with the reason linked (the notice in the cart region).
 */
export function MenuSections({
  menu,
  onAdd,
  orderingClosed = false,
  cutoffNoticeId,
}: {
  menu: BranchMenu
  onAdd: (itemId: string, extraIds: string[], quantity: number) => void
  orderingClosed?: boolean
  cutoffNoticeId?: string
}) {
  if (menu.categories.length === 0) {
    return (
      <section aria-label="Menu">
        <h2 className={styles.srOnly}>Menu</h2>
        <p>No menu has been published yet — please check back soon.</p>
      </section>
    )
  }

  return (
    <div>
      <h2 className={styles.srOnly}>Menu</h2>
      {menu.categories.map((category) => {
        const offeredItems = category.items.filter((item) => item.is_offered)
        return (
          <section
            key={category.id}
            id={`category-${category.id}`}
            className={styles.categorySection}
          >
            <h3>{category.name}</h3>
            {category.description !== null && (
              <p className={styles.categoryDescription}>{category.description}</p>
            )}
            {offeredItems.length === 0 ? (
              <p>Nothing is offered here right now.</p>
            ) : (
              <ul className={styles.itemList}>
                {category.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onAdd={onAdd}
                    orderingClosed={orderingClosed}
                    cutoffNoticeId={cutoffNoticeId}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
