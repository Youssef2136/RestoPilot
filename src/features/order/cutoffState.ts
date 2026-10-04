/*
 * Phase 11 — the customer cutoff + status timeline derivations (specs/031
 * T001; Master Plan §Frontend Phase 11 FR-02/FR-07, D1/D4; contracts/
 * session-client.md; specs/010 §3). Pure functions so the customer page
 * stays composition-only and the rules are unit-testable without a DOM
 * (the house node-environment method).
 *
 * The cutoff IS the server's `submit_round` rule mirrored for presentation
 * (specs/010 §3; migrations/20260920160000_channel_schema.sql): delivery
 * closes when any round is `out_for_delivery` or `completed`; takeaway
 * closes when any round is `ready` or `lock`; dine-in never closes. The
 * server's EXISTS clause reads ALL the session's rounds — voided included
 * (the void is an overlay; the state column stands) — so the mirror checks
 * the same set: parity first, because the ONLY lie that costs money is the
 * UI claiming OPEN when the server will refuse… no: the dangerous lie is
 * the UI claiming CLOSED when the server would accept. Mirroring exactly
 * (voided rounds count) keeps both directions honest. The client can only
 * know what its rounds read has told it: a pending/errored read leaves
 * ordering OPEN (the server covers the race — D1, F3).
 *
 * The timeline maps the SAME states onto the channel's story (D4/FR-07).
 * A state the mapping does not know falls back to the raw chip upstream —
 * the timeline never claims a milestone the payload does not carry (F9).
 */

/** The minimal round shape the customer rounds read provides. */
export interface CustomerRoundState {
  state: string
  voided?: boolean
}

export type Channel = 'dine-in' | 'delivery' | 'takeaway'

const DELIVERY_CUTOFF_STATES = new Set(['out_for_delivery', 'completed'])
const TAKEAWAY_CUTOFF_STATES = new Set(['ready', 'lock'])

/**
 * Whether ADDING is closed for this session (FR-02, D1). Presentation-only:
 * the server's `submit_round` refusal stays the authority, and the submit
 * path remains enabled so that refusal stays possible and verbatim. The
 * check mirrors the server's EXISTS clause EXACTLY — every round of the
 * session, voided included (the customer payload carries no voided flag;
 * server parity is the contract).
 */
export function cutoffCrossed(channel: string, rounds: readonly CustomerRoundState[]): boolean {
  if (channel === 'dine-in') {
    return false
  }
  const closing = channel === 'delivery' ? DELIVERY_CUTOFF_STATES : TAKEAWAY_CUTOFF_STATES
  return rounds.some((round) => closing.has(round.state))
}

/** One milestone in the channel's status story (FR-07, D4). */
export interface TimelineMilestone {
  /** Stable key — the milestone the round's state resolves to. */
  key: 'placed' | 'kitchen' | 'way' | 'pickup' | 'done'
  /** Customer-facing label (the §8.2 vocabulary, channel-inflected). */
  label: string
  /** The states that resolve to this milestone. */
  states: readonly string[]
}

const DELIVERY_TIMELINE: readonly TimelineMilestone[] = [
  { key: 'placed', label: 'Sent to kitchen', states: ['new'] },
  { key: 'kitchen', label: 'In the kitchen', states: ['accepted', 'preparing'] },
  { key: 'way', label: 'On its way', states: ['out_for_delivery'] },
  { key: 'done', label: 'Delivered', states: ['completed'] },
]

const TAKEAWAY_TIMELINE: readonly TimelineMilestone[] = [
  { key: 'placed', label: 'Sent to kitchen', states: ['new'] },
  { key: 'kitchen', label: 'In the kitchen', states: ['accepted', 'preparing'] },
  { key: 'pickup', label: 'Ready for pickup', states: ['ready'] },
  { key: 'done', label: 'Picked up', states: ['lock'] },
]

export function timelineMilestones(channel: string): readonly TimelineMilestone[] | null {
  if (channel === 'delivery') {
    return DELIVERY_TIMELINE
  }
  if (channel === 'takeaway') {
    return TAKEAWAY_TIMELINE
  }
  return null
}

/**
 * The milestone a round's state resolves to, or null when the state is
 * unknown/voided — the caller falls back to the raw state chip (F9: the
 * timeline never renders a milestone the payload does not carry).
 */
export function milestoneFor(
  channel: string,
  state: string,
  voided?: boolean,
): TimelineMilestone | null {
  if (voided) {
    return null
  }
  const milestones = timelineMilestones(channel)
  if (milestones === null) {
    return null
  }
  return milestones.find((milestone) => milestone.states.includes(state)) ?? null
}
