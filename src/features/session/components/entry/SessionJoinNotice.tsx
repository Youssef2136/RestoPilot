import styles from './entry.module.css'

/**
 * The join-existing-session guidance (spec 024 FR-06, Clarification Q4).
 *
 * The server performs open-or-join and its response does not distinguish
 * joined vs created (contract-pinned parseEntry), so the honest affordance
 * is guidance BEFORE submit — rendered under the table picker. The verbatim
 * race refusal ("A session is already open at this table. Join it instead.")
 * still surfaces through the alert region when the RPC fires it.
 */
export function SessionJoinNotice() {
  return (
    <p className={styles.joinNotice} data-entry-join-notice>
      If your table is already open, you'll join it as a new participant.
    </p>
  )
}
