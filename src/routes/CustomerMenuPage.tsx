import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '../components/state'
import { CartRegion } from '../features/order/components/CartRegion'
import { CategoryNav } from '../features/order/components/CategoryNav'
import { MenuSections } from '../features/order/components/MenuSections'
import { RoundsHistory } from '../features/order/components/RoundsHistory'
import { cutoffCrossed } from '../features/order/cutoffState'
import { useSessionRounds } from '../features/order/useOrder'
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
 * read the indicator uses — no new customer read. The cutoff pre-emption
 * (specs/031 FR-02, D1) derives from the SAME rounds cache the history
 * renders — the 10 s poll is the client's knowledge of the server's rule —
 * and never speculates while that read is pending or errored.
 */
export function CustomerMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = sessionTokenScope()
  const menuQuery = useSessionMenu()
  const contextQuery = useSessionContext()
  const roundsQuery = useSessionRounds()
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
        <h1 className={styles.pageTitle}>&nbsp;</h1>
        {/* FR-02: the menu is a network read that routinely exceeds ~300 ms —
            sized placeholders (title bar + category rail + two menu blocks)
            hold the layout so the swap shifts nothing at any breakpoint. */}
        <Skeleton variant="text" lines={3} width="60%" />
        <Skeleton height="10rem" />
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
  // FR-02/D1: disabled ADD affordance only, derived from the shared rounds
  // cache; the cart and the submit path stay alive (the server's verbatim
  // refusal remains the authority).
  const orderingClosed =
    roundsQuery.data !== undefined && cutoffCrossed(channel, roundsQuery.data.rounds)

  return (
    <section className={styles.page}>
      <SessionIndicator />
      <h1 className={styles.pageTitle}>{menu.branch.name}</h1>
      <CategoryNav categories={menu.categories} />
      <div className={styles.menuLayout}>
        <div>
          <MenuSections
            menu={menu}
            onAdd={addLine}
            orderingClosed={orderingClosed}
            cutoffNoticeId="cutoff-notice"
          />
        </div>
        <div className={styles.cartColumn}>
          <CartRegion menu={menu} channel={channel} orderingClosed={orderingClosed} />
        </div>
      </div>
      <RoundsHistory channel={channel} />
    </section>
  )
}
