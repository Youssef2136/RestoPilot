/*
 * Phase 12 — the subscription state copy map (specs/032 FR-05, T003;
 * checklists/realtime-fidelity.md F5). The server derives the lifecycle
 * state (Constitution III) — this map only names it for the owner: one
 * label + one honest detail per state, always carrying the two truths the
 * Master Plan demands: expiry does NOT stop ordering, and renewal is the
 * PLATFORM's action (the restaurant cannot renew itself). Pure data so the
 * panel stays composition-only and the copy is unit-testable without a DOM.
 */

import type { SubscriptionState } from './platformClient'

export interface SubscriptionCopy {
  /** Short state label (the vocabulary, text-bearing). */
  label: string
  /** The honest explanation shown in the detail panel. */
  detail: string
  /** Silent states render no banner and no panel at all. */
  silent: boolean
}

const EXPIRY_TRUTH = 'Ordering is not affected by expiry — customers keep ordering.'
const ACTOR_TRUTH =
  'Renewal is arranged with the platform: the platform owner acts here, not your restaurant.'

/**
 * The console's shared state label (spec 034 D1): the ONE owner-facing
 * vocabulary — the platform console renders the same labels the owner banner
 * does, from this same map. The separate local label map is deleted.
 */
export function stateLabel(state: SubscriptionState): string {
  return subscriptionCopy(state).label
}

export function subscriptionCopy(state: SubscriptionState): SubscriptionCopy {
  switch (state) {
    case 'never_activated':
      return {
        label: 'Not activated yet',
        detail: `The platform has not set subscription dates for this restaurant yet. ${EXPIRY_TRUTH} ${ACTOR_TRUTH}`,
        silent: true,
      }
    case 'active':
      return {
        label: 'Active',
        detail: `The subscription is active. ${EXPIRY_TRUTH}`,
        silent: true,
      }
    case 'nearing_expiration':
      return {
        label: 'Nearing expiration',
        detail: `The subscription end date is within days. ${EXPIRY_TRUTH} ${ACTOR_TRUTH}`,
        silent: false,
      }
    case 'expired':
      return {
        label: 'Expired',
        detail: `The subscription end date has passed. ${EXPIRY_TRUTH} ${ACTOR_TRUTH}`,
        silent: false,
      }
  }
}

/**
 * The manual kill-switch is NOT a lifecycle state and carries the OPPOSITE
 * truth: customer ordering genuinely IS unavailable while it stands, and
 * only the platform can lift it (spec 014 FR-005/FR-006).
 */
export function platformDisabledCopy(reason: string | null): {
  label: string
  detail: string
} {
  return {
    label: 'Disabled by the platform',
    detail: `Customer ordering is unavailable while the platform has this restaurant disabled${reason ? ` (reason recorded: ${reason})` : ''}. Only the platform can re-enable it — expiry never does this, and renewal cannot lift it.`,
  }
}
