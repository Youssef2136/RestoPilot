import { useMySubscription } from './usePlatform'

/**
 * The tenant subscription banner (spec 014 T008, FR-007): the platform
 * truth rendered in the dashboard shell. Active and never-activated are
 * silent (no noise); nearing expiration (≤7 days) renders the in-app
 * warning; expired renders an informational banner that does NOT block
 * anything (the Important rule); disabled renders the platform notice.
 * Nothing here derives state — the server's payload already carries it.
 */

export function SubscriptionBanner() {
  const { data, isPending, isError } = useMySubscription()

  if (isPending || isError || data === null || data === undefined) {
    return null
  }

  if (data.platform_disabled) {
    return (
      <div role="alert" data-testid="subscription-banner" data-banner-state="disabled">
        This restaurant has been disabled by the platform
        {data.platform_disabled_reason ? `: ${data.platform_disabled_reason}` : '.'} Customer
        ordering is unavailable. Contact the platform to resolve this.
      </div>
    )
  }

  if (data.state === 'nearing_expiration') {
    return (
      <div role="status" data-testid="subscription-banner" data-banner-state="nearing_expiration">
        Your subscription is nearing expiration
        {data.end_date ? ` (${data.end_date})` : ''}. Renew with the platform to keep your service
        uninterrupted.
      </div>
    )
  }

  if (data.state === 'expired') {
    return (
      <div role="status" data-testid="subscription-banner" data-banner-state="expired">
        Your subscription has expired{data.end_date ? ` (${data.end_date})` : ''}. Ordering remains
        available — the platform may contact you about renewal.
      </div>
    )
  }

  // active / never_activated: silent.
  return null
}
