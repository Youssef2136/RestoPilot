/*
 * Phase 10 — the kitchen display's age helpers (specs/030 T004; FR-03, D2).
 *
 * The age is a DISPLAY derivation from the queue payload's `created_at` —
 * honest granularity, never fabricated precision: minutes for the first
 * hour, hours-and-minutes after, NEVER seconds (a ticking clock the cook
 * cannot parse and the UI cannot truthfully maintain). The three bands
 * escalate statically (fresh → working → late) — no flashing, no sound;
 * the late treatment is text-bearing (alarm fatigue is the enemy).
 */

export type TicketAgeBand = 'fresh' | 'working' | 'late'

/** Whole minutes elapsed between `createdAt` and `now` (clamped ≥ 0). */
export function ticketAgeMinutes(createdAt: string, now: number = Date.now()): number {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) {
    return 0
  }
  return Math.max(0, Math.floor((now - created) / 60_000))
}

/**
 * The display form: '3 min' under the hour, '1 h 05 min' after — never
 * seconds. Falls back to '—' when the timestamp is unusable (the board
 * never fabricates an age).
 */
export function formatTicketAge(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return '—'
  }
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

/** The staleness band (D2): fresh 0–4, working 5–14, late ≥15. */
export function ticketAgeBand(minutes: number): TicketAgeBand {
  if (minutes >= 15) {
    return 'late'
  }
  if (minutes >= 5) {
    return 'working'
  }
  return 'fresh'
}
