import { milestoneFor, timelineMilestones } from '../cutoffState'
import styles from './order.surfaces.module.css'

/**
 * StatusTimeline (specs/031 FR-07, D4): the channel's status story as a
 * compact milestone list — delivery: Sent to kitchen → In the kitchen → On
 * its way → Delivered; takeaway: … → Ready for pickup → Picked up. The
 * reached step carries `aria-current="step"`; the dispatch/pickup milestone
 * takes the static emphasis treatment (a highlight, never an alarm — no
 * motion, no color-only coding; every step is text-bearing).
 *
 * Rendered ONLY when the round's state maps onto the timeline (unknown and
 * voided states fall back to the caller's raw chip — the timeline never
 * claims a milestone the payload does not carry, F9). Dine-in has no
 * timeline: its frozen chip vocabulary stands untouched.
 */
export function StatusTimeline({
  channel,
  state,
  voided,
}: {
  channel: string
  state: string
  voided?: boolean
}) {
  const milestones = timelineMilestones(channel)
  const reached = milestoneFor(channel, state, voided)
  if (milestones === null || reached === null) {
    return null
  }
  const reachedIndex = milestones.findIndex((milestone) => milestone.key === reached.key)

  return (
    <ol className={styles.timeline}>
      {milestones.map((milestone, index) => {
        const current = index === reachedIndex
        const emphasized = milestone.key === 'way' || milestone.key === 'pickup'
        return (
          <li
            key={milestone.key}
            className={[styles.timelineStep, current ? styles.timelineCurrent : '']
              .concat(current && emphasized ? [styles.timelineEmphasis] : [])
              .filter(Boolean)
              .join(' ')}
            aria-current={current ? 'step' : undefined}
          >
            {milestone.label}
          </li>
        )
      })}
    </ol>
  )
}
