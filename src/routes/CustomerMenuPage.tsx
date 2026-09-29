import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CartRegion } from '../features/order/components/CartRegion'
import { CategoryNav } from '../features/order/components/CategoryNav'
import { MenuSections } from '../features/order/components/MenuSections'
import { RoundsHistory } from '../features/order/components/RoundsHistory'
import { SessionIndicator } from '../features/session/components/SessionIndicator'
import { SESSION_UNAVAILABLE_MESSAGE } from '../features/session/sessionClient'
import {
  forgetSession,
  sessionTokenScope,
  useSessionContext,
  useSessionMenu,
} from '../features/session/useSession'
import { useCart } from '../features/order/useOrder'
import styles from './CustomerMenuPage.module.css'

/**
 * The customer menu page (spec 025; contracts/session-client.md §3):
 * `/r/:slug/menu` — the session indicator, the branch-named menu with its
 * category bar, the cart as a moving sheet/panel (Q1), and the rounds
 * history with the freshness affordance. No dashboard chrome.
 *
 * The recovery rule (FR-013, FR-014 — frozen): the route mount attempts the
 * reads from the stored token; a refused recovery — the single
 * indistinguishable refusal, or no token at all — clears the device and
 * returns the customer to the entry route. Unchanged from its 007/024 shape.
 *
 * The channel (for the CutoffNotice state) rides the same session-context
 * read the indicator uses — no new customer read.
 */
export function CustomerMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = sessionTokenScope()
  const menuQuery = useSessionMenu()
  const contextQuery = useSessionContext()
  const { addLine } = useCart()

  const backToEntry = () => navigate(slug ? `/r/${slug}` : '/', { replace: true })

  // No stored token → nothing to recover; go to entry.
  useEffect(() => {
    if (token === null) {
      backToEntry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // A refused recovery (unknown/tampered/closed all surface the same
  // message, which the client already cleared the token on) → entry.
  const menuError = menuQuery.error
  useEffect(() => {
    if (menuError instanceof Error && menuError.message === SESSION_UNAVAILABLE_MESSAGE) {
      forgetSession(queryClient)
      backToEntry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuError])

  if (menuQuery.isPending) {
    return (
      <section className={styles.page}>
        <SessionIndicator />
        <p>Loading the menu…</p>
      </section>
    )
  }

  if (menuQuery.isError || !menuQuery.data) {
    return (
      <section className={styles.page}>
        <SessionIndicator />
        <p role="alert">{menuQuery.error?.message ?? 'The menu could not be loaded.'}</p>
        <p>
          <Link to={slug ? `/r/${slug}` : '/'}>Back to entry</Link>
        </p>
      </section>
    )
  }

  const menu = menuQuery.data
  const channel = contextQuery.data?.session.type ?? 'dine-in'

  return (
    <section className={styles.page}>
      <SessionIndicator />
      <h1 className={styles.pageTitle}>{menu.branch.name}</h1>
      <CategoryNav categories={menu.categories} />
      <div className={styles.menuLayout}>
        <div>
          <MenuSections menu={menu} onAdd={addLine} />
        </div>
        <div className={styles.cartColumn}>
          <CartRegion menu={menu} channel={channel} />
        </div>
      </div>
      <RoundsHistory />
    </section>
  )
}
