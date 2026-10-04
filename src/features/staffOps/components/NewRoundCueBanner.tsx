import { Link } from 'react-router'
import { Button } from '../../../components/ui'
import { CUE_ARRIVED_COPY } from '../../realtime/announcementPolicy'
import styles from '../staffOps.surfaces.module.css'

/**
 * The new-round cue presentation (specs/012 US4; specs/029 FR-08, D3): a
 * passive live region announcing 'A new order arrived.' with Dismiss, plus
 * the CLEAR PATH to the round — a link naming the destination without
 * colliding with any pinned nav name ('Show the new order' deliberately
 * avoids the word 'Rounds': full-journey's fiona strict-matches that nav
 * link on the dashboard). The text is derived — no payload data beyond
 * what the refetched lists already show (the D3 rule).
 */
export function NewRoundCueBanner({
  cue,
  onDismiss,
  boardHref,
}: {
  cue: { roundId: string } | null
  onDismiss: () => void
  /** When given (the dashboard), the announcement links to the board. */
  boardHref?: string
}) {
  if (cue === null) {
    return null
  }
  return (
    <div role="status" data-live-cue className={styles.cueBanner}>
      <span>{CUE_ARRIVED_COPY}</span>
      {boardHref !== undefined && <Link to={boardHref}>Show the new order</Link>}
      <Button size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}
