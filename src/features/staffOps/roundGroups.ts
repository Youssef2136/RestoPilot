/*
 * Phase 09 — the rounds board's pure helpers (specs/029 T004; contracts/
 * staff-ops-client.md §6; Master Plan §Frontend Phase 09 FR-01/FR-09).
 *
 * The GROUPING and the REFUSAL ROUTING are the board's two derivations, and
 * both live here as pure functions so the page stays composition-only and
 * the rules are unit-testable without a DOM (the house node-environment
 * method).
 *
 * Grouping: the six display groups map the lifecycle states (§3.5) in the
 * order the board renders them — "what needs me now?" first. The void is an
 * OVERLAY, not a state: a voided round stays in its state's group (the card
 * carries the voided styling). A state the mapping does not know renders in
 * its own appended group rather than vanishing — the board never hides a
 * round it cannot classify (honesty over tidiness).
 */

export interface RoundGroupDef {
  key: string
  label: string
  states: readonly string[]
}

/** The board's display groups, in render order (FR-01). */
export const ROUND_GROUP_ORDER: readonly RoundGroupDef[] = [
  { key: 'new', label: 'New orders', states: ['new'] },
  { key: 'in-progress', label: 'In progress', states: ['accepted', 'preparing'] },
  { key: 'ready', label: 'Ready', states: ['ready'] },
  { key: 'out-for-delivery', label: 'Out for delivery', states: ['out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', states: ['completed'] },
  { key: 'served', label: 'Served', states: ['lock'] },
]

/** The group a round state renders in; unknown states group by themselves. */
export function roundGroupKey(state: string): string {
  const known = ROUND_GROUP_ORDER.find((group) => group.states.includes(state))
  return known?.key ?? state
}

export interface RoundGroup<R> {
  key: string
  label: string
  rounds: R[]
}

/**
 * Group rounds by state into the board's display groups (FR-01). The order
 * is `ROUND_GROUP_ORDER`'s; unknown states append their own group (never
 * dropped). The void overlay does NOT move a round out of its state group.
 */
export function groupRoundsByState<R extends { state: string }>(
  rounds: readonly R[],
): RoundGroup<R>[] {
  const buckets = new Map<string, R[]>()
  for (const round of rounds) {
    const key = roundGroupKey(round.state)
    const bucket = buckets.get(key) ?? []
    bucket.push(round)
    buckets.set(key, bucket)
  }

  const groups: RoundGroup<R>[] = []
  for (const def of ROUND_GROUP_ORDER) {
    groups.push({ key: def.key, label: def.label, rounds: buckets.get(def.key) ?? [] })
  }
  for (const [key, groupRounds] of buckets) {
    if (!ROUND_GROUP_ORDER.some((def) => def.key === key)) {
      groups.push({ key, label: key, rounds: groupRounds })
    }
  }
  return groups
}

/**
 * The void boundary per channel (spec 011 FR-004): dine-in at `lock`,
 * delivery at `out_for_delivery`+ (the server accepts through `completed`),
 * takeaway at `ready`. Below the boundary the control is not offered at
 * all — void is not the edit path.
 */
export function isVoidable(round: { session_type: string; state: string }): boolean {
  if (round.session_type === 'dine-in') return round.state === 'lock'
  if (round.session_type === 'delivery')
    return round.state === 'out_for_delivery' || round.state === 'completed'
  return round.state === 'ready'
}

/** Lines may be modified until preparation is under way (spec 009 §4). */
export const MODIFIABLE = new Set(['new', 'accepted', 'preparing'])

/** The channel filter's values (specs/031 FR-05, D2) — 'all' is the default. */
export type ChannelFilterValue = 'all' | 'dine-in' | 'delivery' | 'takeaway'

/**
 * Whether a round survives the channel filter (D2): pure presentation over
 * the already-read board — the default 'all' keeps every round, so the
 * default rendering is exactly the unfiltered board. Unknown channel values
 * survive only the default (the filter never silently widens).
 */
export function matchesChannel(
  round: { session_type: string },
  filter: ChannelFilterValue,
): boolean {
  return filter === 'all' || round.session_type === filter
}

/** One mutation's error posture, shaped like react-query's useMutation result. */
export interface RefusalAttempt {
  isError: boolean
  variables: unknown
  error: unknown
}

/**
 * Route a mutation failure to the originating card (FR-09): the FIRST
 * errored attempt whose variables name this round wins, and the server's
 * message renders verbatim. Transition mutations carry the round id as the
 * variables themselves; modify/void carry `{ roundId, … }`. A non-Error
 * failure falls back to the generic refusal — never silence.
 */
export function pickRefusal(roundId: string, attempts: readonly RefusalAttempt[]): string | null {
  for (const attempt of attempts) {
    if (!attempt.isError) {
      continue
    }
    const variables = attempt.variables
    const matches =
      variables === roundId ||
      (typeof variables === 'object' &&
        variables !== null &&
        (variables as { roundId?: unknown }).roundId === roundId)
    if (matches) {
      return attempt.error instanceof Error ? attempt.error.message : 'The action was refused.'
    }
  }
  return null
}
