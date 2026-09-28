import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext, type ToastEntry, type ToastInput } from './toastTypes'
import styles from './Toast.module.css'

/**
 * Toast (spec 022 FR-04/T009; first consumer: Phase 03 mutation outcomes).
 * A queued host with polite live-region announcement (role="status" — toasts
 * are feedback, not assertive interruptions; inline role="alert" stays the
 * refusal path). Variants map to the status vocabulary; stacking caps at 3
 * (oldest dismissed on overflow); each toast may carry one action and is
 * auto-dismissed after a fixed timeout (6 s; longer with an action).
 */

const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setToasts((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE))
      const timeout = toast.action ? 8000 : 6000
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), timeout),
      )
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* role="region" + aria-live (NOT role="status"): an always-present
          status role would collide with surfaces' asserted getByRole('status')
          strict-mode lookups (spec 023 T006 finding). The live region still
          announces queued toasts politely; empty it is inert. */}
      <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.severity]}`}>
            <p className={styles.message}>{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
