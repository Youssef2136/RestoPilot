import { useId } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Feedback'
import styles from './DataTable.module.css'

/**
 * DataTable (spec 022 FR-04/T008; first consumers: Phases 06/13/14 reports
 * and management tables). Sortable headers are real buttons with aria-sort;
 * empty/loading render as rows (never a detached spinner); the responsive
 * fallback strategy is documented: below the mobile breakpoint the table
 * scrolls horizontally inside its wrapper (min-width table) — card-ification
 * is a per-surface decision for a later phase, not a silent rewrite here.
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
}) {
  const captionId = useId()

  const toggleSort = (columnKey: string) => {
    const current = sort?.columnKey === columnKey ? sort.direction : 'asc'
    onSortChange?.({ columnKey, direction: current === 'asc' ? 'desc' : 'asc' })
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
