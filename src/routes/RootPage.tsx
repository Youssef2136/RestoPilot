import { Link, useLocation } from 'react-router'
import styles from './RootPage.module.css'

/**
 * The public landing (spec 024 FR-08; Clarification Q1 resolving C2).
 *
 * `/` explains what RestoPilot is and offers the two REAL ways in — no
 * invented features: a guest reaches a restaurant's page through its own
 * address (`/r/<slug>`, printed as the QR destination; RestoPilot has no
 * public directory) and a staff member signs in. The h1 stays `RestoPilot`
 * (the routes/smoke/a11y pins), the surface stays landmark-pure under the
 * CustomerShell (one main, no nav — spec 023 FR-01).
 *
 * An old `/order/:branchId` link lands here with `?branch=<id>` (FR-09's
 * redirect); the echoed id is ACKNOWLEDGED only — the landing never fetches
 * anything with it (no public branch→restaurant contract exists) and never
 * leaks tenant names.
 */
export function RootPage() {
  const location = useLocation()
  const echoedBranch = new URLSearchParams(location.search).get('branch')

  return (
    <section className={styles.landing}>
      <h1>RestoPilot</h1>
      <p className={styles.lede}>
        The order-collection layer for restaurants: guests order from their table through the
        restaurant's own page, and the staff run everything behind it.
      </p>

      <div className={styles.ways}>
        <div className={styles.way}>
          <h2>For guests</h2>
          <p>
            Open the link from the restaurant's QR code — it takes you straight to that restaurant's
            page, like <code>/r/restaurant-name</code>.
          </p>
        </div>
        <div className={styles.way}>
          <h2>For restaurant staff</h2>
          <p>
            <Link to="/signin">Sign in</Link> to your restaurant's dashboard.
          </p>
        </div>
      </div>

      {echoedBranch !== null && echoedBranch !== '' && (
        <p role="status" className={styles.deepLinkNote}>
          This old order link doesn't point anywhere on its own — open the restaurant's page from
          its QR code instead.
        </p>
      )}
    </section>
  )
}
