import type { BranchMenuCategory } from '../../menu/menuClient'
import styles from './order.surfaces.module.css'

/**
 * CategoryNav (spec 025 T002; FR-01 as clarified — Q2): the sticky horizontal
 * category bar. Tap scrolls the list to the category section (in-page); each
 * label carries the live count of OFFERED items; a category with zero
 * offered items renders visibly empty (disabled-looking, count 0) instead of
 * mysteriously disappearing — availability awareness at the navigation
 * level.
 */
export function CategoryNav({ categories }: { categories: BranchMenuCategory[] }) {
  const scrollTo = (categoryId: string) => {
    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav aria-label="Menu categories" className={styles.categoryNav}>
      <ul className={styles.categoryList}>
        {categories.map((category) => {
          const offeredCount = category.items.filter((item) => item.is_offered).length
          const empty = offeredCount === 0
          return (
            <li key={category.id}>
              <button
                type="button"
                className={`${styles.categoryButton} ${empty ? styles.categoryButtonEmpty : ''}`}
                onClick={() => scrollTo(category.id)}
              >
                {category.name} ({offeredCount})
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
