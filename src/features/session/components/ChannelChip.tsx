import styles from './channelChip.module.css'
import { channelLabel } from '../sessionClient'

/**
 * The ONE channel chip (specs/031 FR-01; Master Plan Visual Requirements):
 * every surface that names a session's channel renders this same
 * text-bearing pill — dine-in / delivery / takeaway, never a color-only
 * coding, never a paraphrase. The `data-channel-chip` hook and the exact
 * `channelLabel` vocabulary are the frozen E2E contract (staff locators
 * filter cards by hasText: 'Delivery'; the customer entry pin reads the
 * indicator's full sentence), so both the attribute and the label pass
 * through untouched.
 */
export function ChannelChip({ type }: { type: string }) {
  return (
    <span data-channel-chip className={styles.chip}>
      {channelLabel(type)}
    </span>
  )
}
