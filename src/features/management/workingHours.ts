import type { Weekday, WorkingHoursInterval } from './managementClient'

/**
 * Working-hours presentation helpers (contracts/management-client.md §1) —
 * the pure functions shared by the editor and the branch view: weekday order
 * and labels from the `weekday` enum, `HH:MM` normalization (the database
 * returns `time` as `HH:MM:SS`), `closesNextDay`, and the
 * `{weekday, open_time, close_time}[]` ⇄ editor-state conversions.
 *
 * Deliberately NO validation rules: zero-length and same-day-overlap
 * rejection is the server's (`replace_branch_working_hours`, whose
 * declarative constraints are the single source of truth for FR-008) — the
 * editor surfaces the returned message and leaves its state intact.
 */

/** The seven ISO weekdays in declaration (= display and `order by`) order — mirrors the `public.weekday` enum. */
export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** The display labels, keyed by the enum values (the schedule is English-only this phase). */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

/**
 * `HH:MM` normalization: `replace_branch_working_hours` takes `HH:MM`, while
 * the database returns `time` as `HH:MM:SS`. Dropping the seconds part is
 * total (an `HH:MM` input passes through unchanged); the table's
 * minute-precision check guarantees the `:00` seconds.
 */
export function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

/**
 * An interval whose end time is earlier than its start ends on the following
 * day (FR-008) — represented as ONE interval under the day it starts on,
 * never rejected. Both normalized `HH:MM` strings compare chronologically
 * (zero-padded, same length).
 */
export function closesNextDay(openTime: string, closeTime: string): boolean {
  return normalizeTime(closeTime) < normalizeTime(openTime)
}

/**
 * `HH:MM–HH:MM`, with ` (next day)` appended when the interval closes on the
 * following day — the one schedule notation the branch view and the editor's
 * preview use.
 */
export function formatInterval(interval: { open_time: string; close_time: string }): string {
  const times = `${normalizeTime(interval.open_time)}–${normalizeTime(interval.close_time)}`
  return closesNextDay(interval.open_time, interval.close_time) ? `${times} (next day)` : times
}

/** One interval row as the editor holds it — times always `HH:MM`. */
export interface WorkingHoursIntervalDraft {
  open_time: string
  close_time: string
}

/** One weekday's interval rows; an empty list is a day with no open intervals (reads as closed). */
export interface WorkingHoursDayDraft {
  weekday: Weekday
  intervals: WorkingHoursIntervalDraft[]
}

/**
 * The editor's whole-schedule state: all seven weekdays in declaration order,
 * closed days included with an empty list, so the editor renders its
 * per-weekday rows without deriving day order anywhere else.
 */
export type WorkingHoursDraft = WorkingHoursDayDraft[]

/**
 * Stored rows (or any `{weekday, open_time, close_time}` list) → editor
 * state: grouped by weekday in declaration order, times normalized to
 * `HH:MM`, each day's intervals ordered by opening time. Rows arriving in any
 * order or time format produce the same state.
 */
export function toEditorState(rows: readonly WorkingHoursInterval[]): WorkingHoursDraft {
  const byWeekday = new Map<Weekday, WorkingHoursIntervalDraft[]>()
  for (const weekday of WEEKDAYS) {
    byWeekday.set(weekday, [])
  }
  for (const row of rows) {
    byWeekday.get(row.weekday)?.push({
      open_time: normalizeTime(row.open_time),
      close_time: normalizeTime(row.close_time),
    })
  }
  return WEEKDAYS.map((weekday) => {
    const intervals = byWeekday.get(weekday) ?? []
    intervals.sort((a, b) => a.open_time.localeCompare(b.open_time))
    return { weekday, intervals }
  })
}

/**
 * Editor state → the `replace_branch_working_hours` payload: the whole
 * schedule, days in declaration order and each day's intervals in the
 * editor's order, times normalized to the contract's `HH:MM`. Days with no
 * intervals contribute nothing — the server stores exactly what is
 * submitted (an empty payload clears the schedule).
 */
export function toIntervals(draft: WorkingHoursDraft): WorkingHoursInterval[] {
  return draft.flatMap((day) =>
    day.intervals.map((interval) => ({
      weekday: day.weekday,
      open_time: normalizeTime(interval.open_time),
      close_time: normalizeTime(interval.close_time),
    })),
  )
}
