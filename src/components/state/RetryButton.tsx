import { Button } from '../ui'

/**
 * RetryButton (spec 037 FR-04/T001): the explicit-intent retry. It renders a
 * system Button whose default label says what re-running does ("Try again").
 * READ retries only — a mutation's retry lives at the action site (FR-05
 * inline policy); nothing wired through here may re-issue a write without
 * explicit user intent.
 */

export type RetryButtonProps = {
  onRetry: () => void
  label?: string
  /** Set while the retried read is refetching (aria-busy + disabled). */
  loading?: boolean
  /** Disabled with a reason when a retry cannot help (e.g. offline). */
  disabledReason?: string
}

export function RetryButton({
  onRetry,
  label = 'Try again',
  loading,
  disabledReason,
}: RetryButtonProps) {
  return (
    <Button
      variant="secondary"
      onClick={onRetry}
      loading={loading}
      disabled={Boolean(disabledReason)}
      title={disabledReason}
    >
      {disabledReason ?? label}
    </Button>
  )
}
