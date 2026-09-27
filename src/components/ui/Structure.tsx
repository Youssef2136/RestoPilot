import { useId, useRef } from 'react'
import card from './Card.module.css'
import tabs from './Tabs.module.css'
import layout from './Layout.module.css'

/**
 * Structure primitives (spec 022 FR-04/T007; first consumer: Phase 03).
 *
 * Card/Panel — raised surfaces (Panel = the flatter, denser staff variant).
 * SectionHeader — heading + optional actions row (one spacing rhythm).
 * Toolbar — horizontal action row for controls above data.
 * Divider — 1px separator (never a colored accent bar).
 * Stack/Grid — the only two layout helpers; spacing via tokens.
 * Tabs — ARIA tabs with roving focus (arrow keys, Home/End); panels are
 * caller-owned (the primitive renders the tablist and controlled selection).
 */

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={[card.card, className].filter(Boolean).join(' ')}>{children}</div>
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={[card.panel, className].filter(Boolean).join(' ')}>{children}</div>
}

export function SectionHeader({
  title,
  description,
  actions,
  level = 2,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  /** Heading level (h2 default; h3 inside cards). */
  level?: 2 | 3 | 4
}) {
  const Heading = `h${level}` as 'h2'
  return (
    <div className={card.sectionHeader}>
      <div>
        <Heading className={card.sectionTitle}>{title}</Heading>
        {description && <p className={card.sectionDescription}>{description}</p>}
      </div>
      {actions && <div className={card.sectionActions}>{actions}</div>}
    </div>
  )
}

export function Toolbar({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className={card.toolbar} role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={[card.divider, className].filter(Boolean).join(' ')} />
}

export function Stack({
  gap = '5',
  children,
  className,
}: {
  gap?: '2' | '3' | '4' | '5' | '6' | '7' | '8'
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={[layout.stack, layout[`gap-${gap}`], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export function Grid({
  min = '14rem',
  gap = '5',
  children,
  className,
}: {
  min?: string
  gap?: '3' | '4' | '5' | '6' | '7'
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={[layout.grid, layout[`gap-${gap}`], className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}, 1fr))` }}
    >
      {children}
    </div>
  )
}

export type TabItem = { id: string; label: string }

export type TabsProps = {
  items: TabItem[]
  /** The selected tab id (controlled). */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tablist (e.g. "Branch views"). */
  label: string
  /** Panel content per tab id — Tabs owns the tab↔panel wiring (axe
      aria-controls must point at a real panel; a detached TabPanel
      cannot guarantee that). */
  panels?: Record<string, React.ReactNode>
}

export function Tabs({ items, value, onChange, label, panels }: TabsProps) {
  const baseId = useId()
  const refs = useRef(new Map<string, HTMLButtonElement>())

  const move = (from: string, delta: number | 'home' | 'end') => {
    const ids = items.map((i) => i.id)
    const current = ids.indexOf(from)
    const next =
      delta === 'home'
        ? 0
        : delta === 'end'
          ? ids.length - 1
          : (current + delta + ids.length) % ids.length
    const target = ids[next] ?? from
    onChange(target)
    refs.current.get(target)?.focus()
  }

  return (
    <div>
      <div className={tabs.tablist} role="tablist" aria-label={label}>
        {items.map((item) => {
          const selected = item.id === value
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) refs.current.set(item.id, el)
                else refs.current.delete(item.id)
              }}
              type="button"
              role="tab"
              id={`${baseId}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-${item.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={[tabs.tab, selected ? tabs.selected : ''].filter(Boolean).join(' ')}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') move(item.id, 1)
                else if (event.key === 'ArrowLeft') move(item.id, -1)
                else if (event.key === 'Home') move(item.id, 'home')
                else if (event.key === 'End') move(item.id, 'end')
                else return
                event.preventDefault()
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {items.map((item) => {
        const selected = item.id === value
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`${baseId}-${item.id}-panel`}
            aria-labelledby={`${baseId}-${item.id}`}
            hidden={!selected}
            className={tabs.panel}
          >
            {panels?.[item.id]}
          </div>
        )
      })}
    </div>
  )
}
