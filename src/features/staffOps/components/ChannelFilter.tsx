import type { ChannelFilterValue } from '../roundGroups'
import styles from '../staffOps.surfaces.module.css'

/**
 * ChannelFilter (specs/031 FR-05, D2): a compact radio group above the rounds
 * board — All channels (default) / Dine-in / Delivery / Takeaway. Native
 * radios (keyboard-free, screen-reader-free semantics from the platform);
 * the board's groups, counts, and empties derive from the FILTERED set so a
 * narrowed board stays honest. The default value renders exactly the
 * unfiltered board of every frozen anchor.
 */
export function ChannelFilter({
  value,
  onChange,
}: {
  value: ChannelFilterValue
  onChange: (next: ChannelFilterValue) => void
}) {
  const options: { value: ChannelFilterValue; label: string }[] = [
    { value: 'all', label: 'All channels' },
    { value: 'dine-in', label: 'Dine-in' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'takeaway', label: 'Takeaway' },
  ]
  return (
    <fieldset className={styles.channelFilter} data-testid="channel-filter">
      <legend>Channel</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.channelFilterOption}>
          <input
            type="radio"
            name="channel-filter"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />{' '}
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
