import { useQueryClient } from '@tanstack/react-query'
import { channelLabel } from '../sessionClient'
import { forgetSession, useSessionContext } from '../useSession'

/**
 * The minimal session indicator (spec 007 FR-021, clarification 4; spec 010
 * FR-006): restaurant · branch · table — or, for channel sessions, the
 * channel chip plus the read-only delivery address (FR-010, address rendered
 * from the context echo, no new customer read). No controls, no state
 * machine. Rendered on every customer route while a session context
 * resolves.
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

  const { session, indicator } = contextQuery.data

  // Channel sessions have no table — the chip names the channel instead
  // (FR-006), and delivery echoes the entry address read-only (FR-010).
  if (session.table_id === null) {
    return (
      <p aria-live="polite">
        {indicator.restaurant_name} · {indicator.branch_name} ·{' '}
        <strong>{channelLabel(session.type)}</strong>
        {session.type === 'delivery' && session.delivery_address ? (
          <span> — {session.delivery_address}</span>
        ) : null}
      </p>
    )
  }

  return (
    <p aria-live="polite">
      {indicator.restaurant_name} · {indicator.branch_name} · Table {indicator.table_label}
    </p>
  )
}
