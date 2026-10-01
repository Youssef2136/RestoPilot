import styles from '../staffOps.surfaces.module.css'
import { groupRoundsByState } from '../roundGroups'
import type { BranchRound } from '../staffOpsClient'
import { RoundCard } from './RoundCard'
import type { TransitionHandlers } from './TransitionActions'

/**
 * The rounds board (specs/029 FR-01): the branch's rounds grouped by state
 * as labelled regions — heading, count, and the group's cards — "what needs
 * me now?" first (new orders lead). Unknown states append their own group
 * (the board never hides a round). Tablet landscape renders the groups as
 * columns; narrow widths stack the SAME DOM (the css module's @media).
 */

export interface RoundsBoardProps {
  rounds: BranchRound[]
  busy: boolean
  refusalFor: (roundId: string) => string | null
  cuedRoundId: string | null
  billSelectedSessionId: string | null
  onSelectForBill: (round: BranchRound) => void
  onModify: (
    round: BranchRound,
    itemId: string,
    action: 'remove' | 'reduce',
    quantity?: number,
  ) => void
  onVoid: (round: BranchRound, reason: string) => void
  handlers: TransitionHandlers
}

export function RoundsBoard({
  rounds,
  busy,
  refusalFor,
  cuedRoundId,
  billSelectedSessionId,
  onSelectForBill,
  onModify,
  onVoid,
  handlers,
}: RoundsBoardProps) {
  const groups = groupRoundsByState(rounds)
  return (
    <div className={styles.board} data-testid="rounds-board">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className={styles.group}>
          <header className={styles.groupHeader}>
            <h2 className={styles.groupHeading}>{group.label}</h2>
            <span className={styles.groupCount}>{group.rounds.length}</span>
          </header>
          {group.rounds.length === 0 ? (
            <p className={styles.groupEmpty}>Nothing waiting here right now.</p>
          ) : (
            <ul className={styles.groupList}>
              {group.rounds.map((round) => (
                <li key={round.round_id}>
                  <RoundCard
                    round={round}
                    busy={busy}
                    refusal={refusalFor(round.round_id)}
                    cued={round.round_id === cuedRoundId}
                    billSelected={round.session_id === billSelectedSessionId}
                    onSelectForBill={() => onSelectForBill(round)}
                    onModify={(itemId, action, quantity) =>
                      onModify(round, itemId, action, quantity)
                    }
                    onVoid={(reason) => onVoid(round, reason)}
                    handlers={handlers}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
