import { useNewRoundCue } from '../features/realtime/useNewRoundCue'
import { NewRoundCueBanner } from '../features/staffOps/components/NewRoundCueBanner'

/**
 * The in-app operational cue (spec 012 T009; US4, FR-008; specs/029 FR-08,
 * D3): a passive live region in the dashboard shell announcing a new round
 * in the selected branch's scope, now with the clear path to it — a link to
 * the rounds board (named to avoid every pinned nav link). Event-derived,
 * auto-clearing on the round's first state advance; the text is derived —
 * no payload data is rendered beyond what the refetched lists already show
 * (the D3 rule).
 */
export function DashboardLiveCue({ branchId }: { branchId: string | null }) {
  const { cue, clearCue } = useNewRoundCue(branchId)

  if (branchId === null) {
    return null
  }
  return (
    <NewRoundCueBanner
      cue={cue}
      onDismiss={clearCue}
      boardHref={`/dashboard/rounds?branch=${branchId}`}
    />
  )
}
