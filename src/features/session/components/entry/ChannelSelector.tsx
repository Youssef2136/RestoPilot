import styles from './entry.module.css'

/**
 * The channel selector (spec 024 FR-04): the dine-in/delivery/takeaway radio
 * group as a fieldset/legend (a11y contract), each option carrying its
 * one-line explanation. Labels are verbatim-frozen (E2E pins the legend text
 * and the radio names); the explanations are the phase's UX addition.
 */
export type EntryChannel = 'dine-in' | 'delivery' | 'takeaway'

// The dine-in line deliberately avoids the words "Table"/"Branch": the
// entry page's selects are addressed by those EXACT accessible names, and
// label matching is a case-insensitive substring (the phase-023 lesson).
const CHANNEL_LINES: Record<EntryChannel, string> = {
  'dine-in': 'You are seated — pick your spot below.',
  delivery: 'We bring it to your address.',
  takeaway: 'You collect it at the counter.',
}

export function ChannelSelector({
  value,
  onChange,
  disabled,
}: {
  value: EntryChannel
  onChange: (next: EntryChannel) => void
  disabled?: boolean
}) {
  return (
    <fieldset className={styles.channelFieldset} disabled={disabled}>
      <legend>How would you like your order?</legend>
      {(['dine-in', 'delivery', 'takeaway'] as EntryChannel[]).map((channel) => (
        <label key={channel} className={styles.channelOption}>
          <input
            type="radio"
            name="channel"
            value={channel}
            checked={value === channel}
            onChange={() => onChange(channel)}
          />
          <span className={styles.channelName}>
            {channel === 'dine-in' ? 'Dine-in' : channel === 'delivery' ? 'Delivery' : 'Takeaway'}
          </span>
          <span className={styles.channelLine}>{CHANNEL_LINES[channel]}</span>
        </label>
      ))}
    </fieldset>
  )
}
