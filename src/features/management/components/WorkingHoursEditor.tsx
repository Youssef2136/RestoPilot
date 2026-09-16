import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { managementClient, type Weekday, type WorkingHoursRow } from '../managementClient'
import {
  WEEKDAY_LABELS,
  closesNextDay,
  toEditorState,
  toIntervals,
  type WorkingHoursDraft,
} from '../workingHours'

/**
 * The weekly working-hours editor (contracts/management-client.md §1/§4.2;
 * FR-008/FR-009): per-weekday interval rows over the branch's WHOLE schedule
 * — save submits everything through `managementClient`, so the replacement is
 * all-or-nothing at the server (the stored schedule is left unchanged on a
 * rejection). There is no client-side validation: the server's `P0001`
 * message is surfaced verbatim and the editor's submitted state is preserved
 * so the owner can correct it, while the page's read is refreshed to show the
 * unchanged stored schedule.
 *
 * Owner-only by the page's in-page gate (presentation; the RPC remains the
 * authorization boundary — Constitution IV).
 */

/** The initial interval a freshly added row starts from; the owner edits it. */
const NEW_INTERVAL = { open_time: '09:00', close_time: '17:00' } as const

/** The page's schedule query key — the editor refreshes the same read (contract §1). */
function workingHoursQueryKey(branchId: string) {
  return ['management', 'working-hours', branchId] as const
}

interface Feedback {
  tone: 'success' | 'error'
  message: string
}

export interface WorkingHoursEditorProps {
  branchId: string
  /** The stored schedule (the page's policy-scoped read) the draft starts from. */
  schedule: readonly WorkingHoursRow[]
}

export function WorkingHoursEditor({ branchId, schedule }: WorkingHoursEditorProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<WorkingHoursDraft>(() => toEditorState(schedule))
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  function updateInterval(
    weekday: Weekday,
    index: number,
    field: 'open_time' | 'close_time',
    value: string,
  ) {
    setDraft((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              intervals: day.intervals.map((interval, i) =>
                i === index ? { ...interval, [field]: value } : interval,
              ),
            }
          : day,
      ),
    )
  }

  function addInterval(weekday: Weekday) {
    setDraft((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, intervals: [...day.intervals, NEW_INTERVAL] } : day,
      ),
    )
  }

  function removeInterval(weekday: Weekday, index: number) {
    setDraft((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? { ...day, intervals: day.intervals.filter((_, i) => i !== index) }
          : day,
      ),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    const result = await managementClient.replaceBranchWorkingHours({
      branchId,
      intervals: toIntervals(draft),
    })
    setSubmitting(false)
    if (!result.ok) {
      // The server's message, verbatim; the draft stays as submitted so the
      // owner can correct it. The read is refreshed so the displayed stored
      // schedule is provably the server's unchanged state (the replacement
      // is all-or-nothing).
      setFeedback({ tone: 'error', message: result.message })
      void queryClient.invalidateQueries({ queryKey: workingHoursQueryKey(branchId) })
      return
    }
    // The RPC returns the stored rows: re-derive the draft from them and
    // refetch the page's display from the authoritative state.
    setDraft(toEditorState(result.data))
    void queryClient.invalidateQueries({ queryKey: workingHoursQueryKey(branchId) })
    setFeedback({ tone: 'success', message: 'Working hours saved.' })
  }

  return (
    <section aria-labelledby="working-hours-editor-heading">
      <h2 id="working-hours-editor-heading">Edit working hours</h2>
      <form onSubmit={handleSubmit}>
        {draft.map((day) => {
          const label = WEEKDAY_LABELS[day.weekday]
          return (
            <fieldset key={day.weekday}>
              <legend>{label}</legend>
              {day.intervals.length === 0 && <p>No intervals on this day.</p>}
              {day.intervals.map((interval, index) => {
                const openId = `working-hours-${day.weekday}-${index}-open`
                const closeId = `working-hours-${day.weekday}-${index}-close`
                return (
                  <div key={index}>
                    <label htmlFor={openId}>{`${label} interval ${index + 1} opening time`}</label>
                    <input
                      id={openId}
                      type="time"
                      value={interval.open_time}
                      onChange={(event) =>
                        updateInterval(day.weekday, index, 'open_time', event.target.value)
                      }
                    />
                    <label htmlFor={closeId}>{`${label} interval ${index + 1} closing time`}</label>
                    <input
                      id={closeId}
                      type="time"
                      value={interval.close_time}
                      onChange={(event) =>
                        updateInterval(day.weekday, index, 'close_time', event.target.value)
                      }
                    />
                    {closesNextDay(interval.open_time, interval.close_time) && (
                      <p>This interval closes the following day.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => removeInterval(day.weekday, index)}
                      aria-label={`Remove interval ${index + 1} on ${label}`}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
              <button type="button" onClick={() => addInterval(day.weekday)}>
                {`Add interval on ${label}`}
              </button>
            </fieldset>
          )
        })}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save working hours'}
        </button>
      </form>
      {feedback !== null && (
        <p role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
      )}
    </section>
  )
}
