import { NavLink } from 'react-router'
import { visibleNavItems, type NavItem } from '../../app/navigation'
import type { AuthContextMembership } from '../../features/auth/useAuthContext'
import styles from './ShellNav.module.css'

/**
 * ShellNav (spec 023 FR-02/FR-12/T003): renders the ONE navigation model
 * (src/app/navigation.ts) grouped, with `aria-current="page"` via NavLink's
 * `aria-current` behavior. Consumed by the desktop sidebar AND the mobile
 * drawer — never a second list.
 */

const GROUP_LABELS: Record<NavItem['group'], string> = {
  operations: 'Operations',
  configuration: 'Configuration',
  oversight: 'Oversight',
  account: 'Account',
}

const GROUP_ORDER: NavItem['group'][] = ['operations', 'configuration', 'oversight', 'account']

export function ShellNav({
  items,
  memberships,
  restaurantId,
  navLabel,
  onNavigate,
}: {
  items: NavItem[]
  memberships: AuthContextMembership[]
  restaurantId: string | null
  /** The nav landmark's accessible name (the E2E contract: "Staff area"). */
  navLabel: string
  /** Called after a navigation click (closes the mobile drawer). */
  onNavigate?: () => void
}) {
  const visible = visibleNavItems(items, memberships, restaurantId)
  return (
    <nav className={styles.nav} aria-label={navLabel}>
      {GROUP_ORDER.map((group) => {
        const groupItems = visible.filter((item) => item.group === group)
        if (groupItems.length === 0) return null
        return (
          <div key={group} className={styles.group}>
            <p className={styles.groupLabel} aria-hidden="true">
              {GROUP_LABELS[group]}
            </p>
            <ul className={styles.list}>
              {groupItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/dashboard' || item.path === '/admin'}
                    className={({ isActive }) =>
                      [styles.link, isActive ? styles.active : ''].filter(Boolean).join(' ')
                    }
                    onClick={onNavigate}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
