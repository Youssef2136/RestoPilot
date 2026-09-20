import { useState } from 'react'
import { useBranchOpenSessions, useCloseSession } from '../useSession'

/**
 * The staff oversight surface for one branch (spec 007 FR-017): the branch's
 * open dine-in sessions — table label, opened time, participants — with the
 * close action behind `canClose` (the same matrix the RPCs enforce;
 * presentation only, Constitution IV). The list read is the server's
 * scope-checked projection: an out-of-scope branch id arrives as a denial,
 * not an empty list.
 *
 * The close action uses an inline two-step confirmation. Its refusals are
 * rendered verbatim from the server ("This session is already closed.", the
 * generic denial) — no optimistic writes; the list refetch is the state.
 */

interface BranchSessionsPanelProps {
  branchId: string
  branchName: string
  canClose: boolean
}

export function BranchSessionsPanel({ branchId, branchName, canClose }: BranchSessionsPanelProps) {
  const sessionsQuery = useBranchOpenSessions(branchId)
  const closeMutation = useCloseSession(branchId)
  // The session awaiting confirmation, and the outcome of the last close.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [lastClosed, setLastClosed] = useState<string | null>(null)

  if (sessionsQuery.isPending) {
    return (
      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Open sessions — {branchName}</h2>
        <p>Loading the open sessions…</p>
      </section>
    )
  }

  if (sessionsQuery.isError) {
    // Includes the server's own scope refusal for an out-of-scope branch.
    return (
      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Open sessions — {branchName}</h2>
        <p role="alert">The open sessions could not be loaded. Try again.</p>
      </section>
    )
  }

  const sessions = sessionsQuery.data.sessions

  return (
    <section aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">Open sessions — {branchName}</h2>

      {sessions.length === 0 ? (
        <p>No open sessions at this branch.</p>
      ) : (
        <ul>
          {sessions.map((session) => {
            const confirming = confirmingId === session.id
            const closeError =
              closeMutation.error !== null &&
              closeMutation.variables === session.id &&
              closeMutation.error instanceof Error
                ? closeMutation.error.message
                : null
            return (
              <li key={session.id}>
                <p>
                  <strong>{session.table_label}</strong> — opened{' '}
                  {new Date(session.opened_at).toLocaleTimeString()}
                </p>
                <p>
                  {session.participants.length === 0
                    ? 'No participants listed.'
                    : `Participants: ${session.participants.map((p) => p.display_name).join(', ')}`}
                </p>
                {canClose &&
                  (confirming ? (
                    <span>
                      <button
                        type="button"
                        disabled={closeMutation.isPending}
                        onClick={() => {
                          closeMutation.mutate(session.id, {
                            onSuccess: () => {
                              setConfirmingId(null)
                              setLastClosed(session.table_label)
                            },
                          })
                        }}
                      >
                        {closeMutation.isPending
                          ? 'Closing…'
                          : `Confirm closing ${session.table_label}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={closeMutation.isPending}
                      >
                        Keep it open
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmingId(session.id)}>
                      {`Close session for ${session.table_label}`}
                    </button>
                  ))}
                {closeError !== null && <p role="alert">{closeError}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {lastClosed !== null && (
        <p role="status">
          {lastClosed}&apos;s session was closed. Seated guests recover as unavailable and re-enter
          the table&apos;s new session.
        </p>
      )}
    </section>
  )
}
