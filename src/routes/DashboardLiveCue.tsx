import { useNewRoundCue } from '../features/realtime/useNewRoundCue'

/**
 * The in-app operational cue (spec 012 T009; US4, FR-008): a passive live
 * region in the dashboard shell announcing a new round in the selected
 * branch's scope. Event-derived, auto-clearing on the round's first state
 * advance; the text is derived — no payload data is rendered beyond what
 * the refetched lists already show (the D3 rule).
 */
export function DashboardLiveCue({ branchId }: { branchId: string | null }) {
  const { cue, clearCue } = useNewRoundCue(branchId)

  if (branchId === null || cue === null) {
    return null
  }
  return (
    <div role="status" data-live-cue>
      A new order arrived.{' '}
      <button type="button" onClick={clearCue}>
        Dismiss
      </button>
    </div>
  )
}
