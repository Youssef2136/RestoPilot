import { useEffect } from 'react'
import { useLocation } from 'react-router'
import styles from './management.module.css'

/**
 * ManagementLayout (spec 026 T001; FR-01/FR-06 as clarified — Q1): wraps a
 * management page's sections with a sticky in-page section nav. Each section
 * keeps its own id; a nav click scrolls to it and reflects the fragment in
 * the URL (documented section navigation — no tabs, no new routes). The nav
 * collapses to a horizontal scroller below 1024px (the phase-05 pattern).
 *
 * A11y: the nav is a `nav` with a DISTINCT label — never 'Staff area' (the
 * shell nav's frozen name). Fully keyboard-operable (plain buttons).
 */
export function ManagementLayout({
  label,
  sections,
  children,
}: {
  label: string
  sections: ReadonlyArray<{ id: string; label: string }>
  children: React.ReactNode
}) {
  const location = useLocation()

  // Re-scroll when a fragment arrives via deep link or in-page navigation.
  useEffect(() => {
    if (location.hash === '') return
    const target = document.getElementById(location.hash.slice(1))
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const jump = (id: string) => {
    window.history.replaceState(null, '', `#${id}`)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.layout}>
      <nav aria-label={label} className={styles.sectionNav}>
        <ul className={styles.sectionList}>
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={styles.sectionButton}
                onClick={() => jump(section.id)}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.sections}>{children}</div>
    </div>
  )
}
