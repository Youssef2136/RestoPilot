import { useState } from 'react'
import { useRealtimeInvalidation } from '../../realtime/useRealtimeInvalidation'
import { ConfirmDialog, Button, useToast } from '../../../components/ui'
import styles from '../../staffOps/staffOps.surfaces.module.css'
import { branchSessionsKey, useBranchOpenSessions, useCloseSession } from '../useSession'

/**
 * The staff oversight surface for one branch (spec 007 FR-017; specs/029
 * FR-06): the branch's open dine-in sessions — table label, opened time,
 * participants — with the close action behind `canClose` (the same matrix
 * the RPCs enforce; presentation only, Constitution IV). The list read is
 * the server's scope-checked projection: an out-of-scope branch id arrives
 * as a denial, not an empty list.
 *
 * The close action uses an inline two-step confirmation. Its refusals are
 * rendered verbatim from the server ("This session is already closed.", the
 * generic denial) — no optimistic writes; the list refetch is the state.
 * The inline closure notice is the ONLY role="status" on this surface (the
 * pinned strict lookup); the toast host stays role="region".
 */

interface BranchSessionsPanelProps {
  branchId: string
  branchName: string
  canClose: boolean
}

export function BranchSessionsPanel({ branchId, branchName, canClose }: BranchSessionsPanelProps) {
  // The live session list (spec 012 US5, FR-009): session-state changes
  // (closes) invalidate the branch sessions read — no manual refresh.
  useRealtimeInvalidation({
    scopeValue: branchId,
    table: 'sessions',
    invalidate: (qc) => qc.invalidateQueries({ queryKey: branchSessionsKey(branchId) }),
  })
  const sessionsQuery = useBranchOpenSessions(branchId)
  const closeMutation = useCloseSession(branchId)
  // The session awaiting confirmation, and the outcome of the last close.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const toast = useToast()
  const [lastClosed, setLastClosed] = useState<string | null>(null)

  if (sessionsQuery.isPending) {
    return (
      <section aria-labelledby="sessions-heading" data-density="compact">
        <h2 id="sessions-heading">Open sessions — {branchName}</h2>
        <p>Loading the open sessions…</p>
      </section>
    )
  }

  if (sessionsQuery.isError) {
    // Includes the server's own scope refusal for an out-of-scope branch.
    return (
      <section aria-labelledby="sessions-heading" data-density="compact">
        <h2 id="sessions-heading">Open sessions — {branchName}</h2>
        <p role="alert">The open sessions could not be loaded. Try again.</p>
      </section>
    )
  }

  const sessions = sessionsQuery.data.sessions

  return (
    <section aria-labelledby="sessions-heading" data-density="compact">
      <h2 id="sessions-heading">Open sessions — {branchName}</h2>

      {sessions.length === 0 ? (
        <p>No open sessions at this branch.</p>
      ) : (
        <ul className={styles.sessionsList}>
          {sessions.map((session) => {
            const confirming = confirmingId === session.id
            const closeError =
              closeMutation.error !== null &&
              closeMutation.variables === session.id &&
              closeMutation.error instanceof Error
                ? closeMutation.error.message
                : null
            return (
              <li key={session.id} className={styles.sessionRow}>
                <p className={styles.sessionMain}>{session.table_label}</p>
                <p className={styles.sessionMeta}>
                  Opened {new Date(session.opened_at).toLocaleTimeString()}
                </p>
                <p className={styles.participants}>
                  {session.participants.length === 0
                    ? 'No participants listed.'
                    : session.participants.map((p) => (
                        <span key={p.id} className={styles.participantChip}>
                          {p.display_name}
                        </span>
                      ))}
                </p>
                {canClose && (
                  <div className={styles.sessionActions}>
                    {/* Spec 023 FR-06 (Q4): the two-step confirmation runs
                        through the ConfirmDialog primitive. Names preserved
                        verbatim: "Close session for T1" opens; "Confirm
                        closing T1" confirms (E2E contract); "Keep it open"
                        becomes the dialog's cancel (also pre-existing). */}
                    <Button
                      className={styles.touchAction}
                      onClick={() => setConfirmingId(session.id)}
                    >
                      {`Close session for ${session.table_label}`}
                    </Button>
                    <ConfirmDialog
                      open={confirming}
                      onCancel={() => setConfirmingId(null)}
                      title={`Close session for ${session.table_label}`}
                      confirmLabel={
                        closeMutation.isPending
                          ? 'Closing…'
                          : `Confirm closing ${session.table_label}`
                      }
                      cancelLabel="Keep it open"
                      busy={closeMutation.isPending}
                      error={closeError ?? undefined}
                      onConfirm={() => {
                        closeMutation.mutate(session.id, {
                          onSuccess: () => {
                            setConfirmingId(null)
                            setLastClosed(session.table_label)
                            // Spec 023 FR-05 (Q3): the toast ACCOMPANIES the
                            // asserted inline role="status" text — never
                            // replaces it.
                            toast.show({
                              severity: 'success',
                              message: `${session.table_label}'s session was closed.`,
                            })
                          },
                          onError: () => {
                            toast.show({
                              severity: 'danger',
                              message:
                                closeMutation.error instanceof Error
                                  ? closeMutation.error.message
                                  : 'The session close failed. Try again.',
                            })
                          },
                        })
                      }}
                    >
                      <p>
                        This closes {session.table_label}&apos;s session: seated guests recover as
                        unavailable and re-enter the table&apos;s new session.
                      </p>
                    </ConfirmDialog>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {lastClosed !== null && (
        <p role="status" className={styles.closedNotice}>
          {lastClosed}&apos;s session was closed. Seated guests recover as unavailable and re-enter
          the table&apos;s new session.
        </p>
      )}
    </section>
  )
}
