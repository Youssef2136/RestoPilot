/**
 * Customer-facing wording for a round's lifecycle state (spec 025 T001/T006;
 * the §8.2 machine, 009): the customer sees where their order stands, not the
 * raw column. `new` is "Sent to kitchen" — the submission is the customer's
 * last act; `lock` is "Served" — the cashier's close of service. Extracted
 * from RoundsHistory so the customer variant and any other surface share the
 * exact vocabulary (frozen).
 */
export const ROUND_STATE_LABEL: Record<string, string> = {
  new: 'Sent to kitchen',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  ready: 'Ready',
  lock: 'Served',
}

export function roundStateLabel(state: string): string {
  return ROUND_STATE_LABEL[state] ?? state
}
