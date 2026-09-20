import { useQueryClient } from '@tanstack/react-query'
import { forgetSession, useSessionContext } from '../useSession'

/**
 * The minimal session indicator (spec 007 FR-021, clarification 4):
 * restaurant · branch · table, a link back to the menu route, and nothing
 * else — no controls, no state machine. Rendered on every customer route
 * while a session context resolves.
 *
 * The context query clears the stored token through the client when the
 * session is refused (the closed/unknown indistinguishable refusal, FR-014);
 * this component surfaces that state as the return-to-entry hint.
 */
export function SessionIndicator() {
  const queryClient = useQueryClient()
  const contextQuery = useSessionContext()

  if (contextQuery.isPending) {
    return <p aria-live="polite">Restoring your session…</p>
  }

  if (contextQuery.isError || !contextQuery.data) {
    return (
      <p role="status">
        Your session is no longer available.{' '}
        <a
          href="/"
          onClick={() => {
            // Drop token-scoped cache entries along with the token itself.
            forgetSession(queryClient)
          }}
        >
          Start again
        </a>
      </p>
    )
  }

  const { indicator } = contextQuery.data

  return (
    <p aria-live="polite">
      {indicator.restaurant_name} · {indicator.branch_name} · Table {indicator.table_label}
    </p>
  )
}
