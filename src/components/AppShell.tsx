import { Link, Outlet } from 'react-router'
import styles from './AppShell.module.css'

/**
 * Minimal application shell (spec FR-011): root layout with placeholder
 * navigation for the three application experiences. Route guards, role-aware
 * navigation, and business UI belong to later phases.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          RestoPilot
        </Link>
        <nav className={styles.nav} aria-label="Application areas">
          <Link to="/r/demo-restaurant">Customer</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
