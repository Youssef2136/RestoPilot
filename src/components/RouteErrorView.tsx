import styles from './RouteErrorView.module.css'

/**
 * The recoverable error view (spec 021 FR-03 / US1): a human-readable screen
 * with a route back — never a white screen, never the internal error message.
 * Rendered by ErrorBoundary; `minimal` renders the no-recursion static
 * fallback (nested-boundary edge case).
 *
 * The route-back affordances are PLAIN ANCHORS, deliberately not client-side
 * links: the boundary above holds the caught error, so only a full document
 * load rebuilds the tree. Recovery through the browser's normal navigation
 * is exactly the reset the error state needs.
 *
 * Spec 035 (F-002): renders a labelled SECTION, not a second <main> — same
 * rationale as NotFoundView (one main landmark per document; the shell owns
 * it). No pinned E2E assertion binds the element tag here.
 */
export function RouteErrorView({ minimal = false }: { minimal?: boolean }) {
  if (minimal) {
    return (
      <section aria-label="Something went wrong">
        <p role="alert">Something went wrong. Please reload the page.</p>
      </section>
    )
  }

  return (
    <section aria-label="Something went wrong" className={styles.view}>
      <h1>Something went wrong</h1>
      <p role="alert">
        An unexpected error occurred while rendering this view. You can return to a working area of
        the application.
      </p>
      <div className={styles.actions}>
        <a href="/dashboard">Go to dashboard</a>
        <a href="/signin">Go to sign-in</a>
      </div>
    </section>
  )
}
