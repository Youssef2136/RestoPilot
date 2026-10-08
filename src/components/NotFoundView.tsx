import { Link } from 'react-router'
import styles from './NotFoundView.module.css'

/**
 * The unknown-route view (spec 021 FR-04 / US1; Clarification Q1): a
 * dedicated 404 — never a silent redirect. Offers the route back to the
 * public entry and the dashboard.
 *
 * Spec 035 (F-002): renders a labelled SECTION, not a second <main> — the
 * shell already owns the document's single main landmark, and a nested
 * main (duplicate #main) is invalid and misleading for AT. The h1/alert/
 * links (the pinned E2E anchors) are byte-identical.
 */
export function NotFoundView() {
  return (
    <section aria-label="Page not found" className={styles.view}>
      <h1>Page not found</h1>
      <p role="alert">
        This address does not match any page in RestoPilot. Use one of the links below to continue.
      </p>
      <div className={styles.actions}>
        <Link to="/">Go to the entry page</Link>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    </section>
  )
}
