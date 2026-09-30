import styles from './menu.surfaces.module.css'

/**
 * The item filter (spec 027 T004; Master Plan FR-02 "search/filter"): one
 * labelled box narrowing the items rendered inside every category region.
 * Purely a READ concern — no data changes, no reordering side effects — so
 * the reorder/availability logic can stay untouched behind it.
 *
 * Matching is a case-insensitive substring on the item's name AND description
 * (the owner's "find that dish" flow); the value is owned by the caller so
 * the filtered-empty messaging can react per category. The matching rule
 * itself lives with the panel (a component-only module per the fast-refresh
 * contract).
 */
export function MenuFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className={styles.filterBar}>
      <label htmlFor="menu-item-filter">Filter items</label>
      <input
        id="menu-item-filter"
        className={styles.filterInput}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name or description"
      />
    </div>
  )
}
