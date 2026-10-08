import { useEffect, useId, useState } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Feedback'
import styles from './DataTable.module.css'

/**
 * DataTable (spec 022 FR-04/T008; first consumers: Phases 06/13/14 reports
 * and management tables). Sortable headers are real buttons with aria-sort;
 * empty/loading render as rows (never a detached spinner); the responsive
 * fallback strategy is documented and implemented (spec 036 T008): a
 * per-instance `cardBreakpoint` renders the SAME columns as row cards below
 * the crossover width (a media-query-free matchMedia listener) — same data,
 * same disclosure, no column lost. Without `cardBreakpoint` the documented
 * scroll-region fallback holds (min-width table inside the wrapper).
 */

export type DataTableColumn<T> = {
  key: string
  header: string
  /** Left-to-right render order. */
  render: (row: T) => React.ReactNode
  /** Enables the sort header button (caller owns the actual sorting). */
  sortable?: boolean
  /** Numeric columns right-align with tabular numerals. */
  numeric?: boolean
  minWidth?: string
}

export type DataTableSort = { columnKey: string; direction: 'asc' | 'desc' }

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  loading = false,
  emptyMessage = 'Nothing here yet.',
  caption,
  cardBreakpoint,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort) => void
  loading?: boolean
  /** The EmptyState-style message row when there is no data. */
  emptyMessage?: string
  caption?: string
  /**
   * The card-fallback crossover in px (spec 036 FR-06): when the viewport is
   * narrower, each row renders as a card (label + value per column — the
   * exact fields the table shows, same order). Omit for the scroll-region
   * fallback. Values come from the same `render` functions — one disclosure.
   */
  cardBreakpoint?: number
}) {
  const captionId = useId()
  const cards = useCardFallback(cardBreakpoint)

  const toggleSort = (columnKey: string) => {
    const current = sort?.columnKey === columnKey ? sort.direction : 'asc'
    onSortChange?.({ columnKey, direction: current === 'asc' ? 'desc' : 'asc' })
  }

  if (cards) {
    return (
      <div className={styles.wrapper}>
        {caption && (
          <div id={captionId} className={styles.caption}>
            {caption}
          </div>
        )}
        <ul className={styles.cardList} aria-labelledby={caption ? captionId : undefined}>
          {loading ? (
            <li className={styles.card} aria-busy="true">
              <Spinner label="Loading rows" />
            </li>
          ) : rows.length === 0 ? (
            <li className={`${styles.card} ${styles.emptyCell}`}>{emptyMessage}</li>
          ) : (
            rows.map((row) => (
              <li key={rowKey(row)} className={styles.card}>
                {columns.map((column) => (
                  <div key={column.key} className={styles.cardRow}>
                    <span className={styles.cardLabel}>
                      {column.header}
                      {column.sortable ? (
                        <span className={styles.sortIcon} aria-hidden="true">
                          {'\u2003'}
                        </span>
                      ) : null}
                    </span>
                    <span className={column.numeric ? styles.cardValueNumeric : styles.cardValue}>
                      {column.render(row)}
                    </span>
                  </div>
                ))}
              </li>
            ))
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table} aria-labelledby={caption ? captionId : undefined}>
        {caption && (
          <caption id={captionId} className={styles.caption}>
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sort?.columnKey === column.key
              const ariaSort = isSorted
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={[
                    column.numeric ? styles.numeric : '',
                    column.minWidth ? styles.minWidth : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      <span className={styles.sortIcon} aria-hidden="true">
                        <Icon
                          name={
                            isSorted && sort?.direction === 'desc' ? 'chevron-down' : 'chevron-down'
                          }
                          size={14}
                        />
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className={styles.stateCell}>
                <Spinner label="Loading rows" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={[styles.stateCell, styles.emptyCell].join(' ')}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? styles.numeric : undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The card-fallback listener (spec 036 T008): a media-query-free matchMedia
 * subscription (custom properties cannot feed `@media`, so the crossover is
 * an instance prop, not a stylesheet rule). SSR-safe: defaults to the table
 * until a viewport is measured.
 */
function useCardFallback(breakpoint: number | undefined): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (breakpoint === undefined) return
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])
  return breakpoint !== undefined && matches
}

/** Definition-list key/value rows (branch detail, session context). */
export function KeyValueList({ items }: { items: { key: string; value: React.ReactNode }[] }) {
  return (
    <dl className={styles.keyValue}>
      {items.map((item) => (
        <div key={item.key} className={styles.keyValueRow}>
          <dt className={styles.keyValueKey}>{item.key}</dt>
          <dd className={styles.keyValueValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Pagination — page controls for server-paginated reads; `LoadMore` renders
 * the incremental variant. Both are plain buttons + live status text.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = 'Pagination',
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  label?: string
}) {
  return (
    <nav className={styles.pagination} aria-label={label}>
      <button
        type="button"
        className={styles.pageButton}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <span className={styles.pageStatus}>
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={styles.pageButton}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </nav>
  )
}

export function LoadMore({
  onMore,
  loading = false,
  label = 'Load more',
}: {
  onMore: () => void
  loading?: boolean
  label?: string
}) {
  return (
    <div className={styles.loadMore}>
      <button type="button" className={styles.loadMoreButton} onClick={onMore} disabled={loading}>
        {loading ? <Spinner label="Loading" /> : label}
      </button>
    </div>
  )
}
