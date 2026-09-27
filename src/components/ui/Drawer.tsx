import { useEffect, useId, useRef } from 'react'
import styles from './Drawer.module.css'

/**
 * Drawer (spec 022 FR-04/T006; first consumer: Phase 03 mobile nav).
 * A fixed-position side panel over the page (the one overlay that cannot
 * use native <dialog> positioning); focus moves in on open and returns to
 * the opener on close; Esc closes; a scrim click closes (mobile nav is a
 * low-stakes surface — unlike the confirm dialog).
 *
 * Focus trap: kept deliberately simple (Tab cycling between the panel's
 * first/last focusable elements) — Phase 03 renders nav links only.
 */

export type DrawerProps = {
  open: boolean
  onClose: () => void
  /** Accessible name (required). */
  title: string
  side?: 'start' | 'end'
  children?: React.ReactNode
}

export function Drawer({ open, onClose, title, side = 'start', children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('a, button, input, select, textarea, [tabindex]')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  // The scrim is a click-away affordance; keyboard users close with Esc
  // (handled on document above) — the rule's keyboard path is the Esc key,
  // so the pointer-only handler is deliberate here.
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- scrim click-away; keyboard closes via Esc on document
    <div className={styles.scrim} onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- stops scrim click-through; the panel is a dialog role */}
      <div
        ref={panelRef}
        className={[styles.panel, styles[side]].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
