import { useEffect, useId, useRef } from 'react'
import styles from './Dialog.module.css'

/**
 * Dialog (spec 022 FR-04/T006; first consumer: Phase 03 confirm adoption).
 * Native `<dialog>` (operate.md: overlays escape their container — the top
 * layer solves it). Focus is trapped by the browser and restored on close;
 * Esc closes via `cancel`. States: open / confirming (busy) / error slot.
 *
 * The confirm variant pairs a danger action with a required explicit cancel
 * — destructive actions never rely on a single click (UX rule).
 */

export type DialogProps = {
  open: boolean
  onClose: () => void
  /** Accessible name (required — a dialog without a name fails axe). */
  title: string
  children?: React.ReactNode
  /** Renders the footer action row: pass DialogActions content. */
  actions?: React.ReactNode
  /** Busy state: actions disabled + aria-busy on the dialog. */
  busy?: boolean
  /** Verbatim error message rendered above the actions (role="alert"). */
  error?: string
}

export function Dialog({ open, onClose, title, children, actions, busy, error }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // The backdrop click should not close destructive confirmations by
  // accident; Esc still works (native cancel). Controlled close only.
  const handleCancel = (event: React.SyntheticEvent) => {
    event.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={handleCancel}
      onClose={onClose}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </dialog>
  )
} /** Convenience composition for the confirm pattern (Phase 03 adoption).
    `confirmDisabled` lets a caller gate the confirm on its own validity
    (e.g. a required reason — the E2E flow asserts the disabled state). */
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy,
  confirmDisabled = false,
  error,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  children?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  confirmDisabled?: boolean
  error?: string
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      busy={busy}
      error={error}
      actions={
        <>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
