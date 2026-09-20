import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BranchMenuPreview } from '../features/menu/components/BranchMenuPreview'
import { SessionIndicator } from '../features/session/components/SessionIndicator'
import { SESSION_UNAVAILABLE_MESSAGE } from '../features/session/sessionClient'
import { forgetSession, sessionTokenScope, useSessionMenu } from '../features/session/useSession'

/**
 * The customer menu page (spec 007 FR-021; contracts/session-client.md §3):
 * `/r/:slug/menu` — the session's branch menu, as the database assembles it
 * for the token's session (feature 005's payload), under the session
 * indicator. No dashboard chrome.
 *
 * The recovery rule (FR-013, FR-014): the route mount attempts the reads
 * from the stored token; a refused recovery — the single indistinguishable
 * refusal, or no token at all — clears the device and returns the customer
 * to the entry route. The client clears the token on the refusal; the
 * forget keeps the cache in step and the redirect completes the rule.
 */
export function CustomerMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = sessionTokenScope()
  const menuQuery = useSessionMenu()

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
      <section>
        <SessionIndicator />
        <p>Loading the menu…</p>
      </section>
    )
  }

  if (menuQuery.isError || !menuQuery.data) {
    return (
      <section>
        <SessionIndicator />
        <p role="alert">{menuQuery.error?.message ?? 'The menu could not be loaded.'}</p>
        <p>
          <Link to={slug ? `/r/${slug}` : '/'}>Back to entry</Link>
        </p>
      </section>
    )
  }

  const menu = menuQuery.data

  return (
    <section>
      <SessionIndicator />
      <h1>{menu.branch.name}</h1>
      <BranchMenuPreview menu={menu} />
    </section>
  )
}
