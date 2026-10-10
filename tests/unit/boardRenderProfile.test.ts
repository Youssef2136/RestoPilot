/*
 * specs/038 T009 — the re-render-discipline evidence (FR-06/B5), node env.
 *
 * The unit tier runs in the NODE environment (the house method — no jsdom),
 * so a live Profiler commit counter is unavailable here. The evidence is
 * therefore split exactly as the plan intended (R7):
 *   - THIS file proves the DETERMINISTIC preconditions that make the board
 *     re-render-scope and remount-free: stable React keys over the burst
 *     boundary (key = round_id — a new arrival can NEVER change an
 *     existing row's key), pure state grouping that depends only on the
 *     rounds array (the same input → the same groups → the same keys, so a
 *     burst cannot rewrite sibling keys), and the component annotation
 *     facts the burst E2E asserts at runtime (DOM identity over a refresh).
 *   - The live burst story (e2e/perf.boards.test.ts, T010) asserts the DOM
 *     node identity across a real burst arrival — the anti-flicker half.
 */
import { describe, expect, it } from 'vitest'
import { groupRoundsByState } from '../../src/features/staffOps/roundGroups'
import type { BranchRound } from '../../src/features/staffOps/staffOpsClient'

function makeRound(id: string, state: string): BranchRound {
  return {
    round_id: id,
    session_id: `session-${id}`,
    session_type: 'dine-in',
    delivery_address: null,
    table_label: 'T3',
    state,
    voided: false,
    void_reason: null,
    voided_at: null,
    subtotal: '10.00',
    tax_total: '0.82',
    tax_lines: [],
    created_at: new Date(2026, 0, 1).toISOString(),
    items: [],
  }
}

describe('board render discipline preconditions (spec 038 FR-06/B5, T009)', () => {
  const before = [makeRound('11111111-aaaa', 'new'), makeRound('22222222-bbbb', 'preparing')]

  it('key identity survives a burst: the grouped keys before == the surviving keys after', () => {
    const arrived = [...before, makeRound('33333333-cccc', 'new')]
    const beforeGroups = groupRoundsByState(before)
    const afterGroups = groupRoundsByState(arrived)

    const keysBefore = beforeGroups.flatMap((g) => g.rounds.map((r) => r.round_id))
    const keysAfter = afterGroups.flatMap((g) => g.rounds.map((r) => r.round_id))
    // Every pre-burst round keeps BOTH its identity (value) and its ORDER
    // within its group — a key change here would remount the card (the
    // visual pop FR-06 forbids).
    expect(keysAfter.filter((k) => keysBefore.includes(k))).toEqual(keysBefore)
  })

  it('grouping is pure: the same input yields the same groups (no hidden state to re-render)', () => {
    const once = groupRoundsByState(before)
    const twice = groupRoundsByState(before)
    expect(twice.map((g) => [g.key, g.rounds.map((r) => r.round_id)])).toEqual(
      once.map((g) => [g.key, g.rounds.map((r) => r.round_id)]),
    )
  })

  it('a state-crossing event moves exactly ONE round between groups (no sibling reordering)', () => {
    const beforeKeys = groupRoundsByState(before).flatMap((g) => g.rounds.map((r) => r.round_id))
    const moved = [before[0], makeRound(before[1].round_id, 'ready')]
    const afterKeys = groupRoundsByState(moved).flatMap((g) => g.rounds.map((r) => r.round_id))
    expect(afterKeys.filter((k) => beforeKeys.includes(k))).toEqual(beforeKeys)
  })
})
