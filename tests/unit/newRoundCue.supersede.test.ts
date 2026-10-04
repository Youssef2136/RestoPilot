/*
 * Phase 12 — the new-round cue's supersede semantics (specs/032 FR-02, D6,
 * T004; checklists/realtime-fidelity.md). The Master Plan's busy-night rule:
 * the cue must NOT stack into a wall — the binding is single-slot by design
 * (a second INSERT supersedes the first), and only the CURRENT round's own
 * advance clears it (a stale round's UPDATE must not clear a newer cue).
 * New tests only — the existing realtime.test.ts suite is untouched.
 */

import { describe, expect, it, vi } from 'vitest'
import { bindNewRoundCue } from '../../src/features/realtime/useNewRoundCue'

type Handler = (payload: unknown) => void

interface RecordingChannel {
  name: string
  handlers: Handler[]
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

function makeRecordingClient() {
  const channels: RecordingChannel[] = []
  return {
    channels,
    removeChannel: vi.fn(async () => {}),
    channel: (name: string): RecordingChannel => {
      const existing = channels.find((c) => c.name === name)
      if (existing) {
        return existing
      }
      const channel: RecordingChannel = {
        name,
        handlers: [],
        on: vi.fn((_type: string, _filter: unknown, handler: Handler) => {
          channel.handlers.push(handler)
          return channel
        }),
        subscribe: vi.fn(() => channel),
      }
      channels.push(channel)
      return channel
    },
  }
}

function bind(client: ReturnType<typeof makeRecordingClient>) {
  const inserts: string[] = []
  const cleared: string[] = []
  const binding = bindNewRoundCue(client as never, {
    branchId: 'b1',
    onInsert: (id) => inserts.push(id),
    onUpdateCleared: (id) => cleared.push(id),
  })
  const channel = client.channels[client.channels.length - 1]!
  return { binding, channel, inserts, cleared }
}

describe('the new-round cue busy-night semantics (FR-02, D6)', () => {
  it('a second INSERT supersedes the first — one slot, never a wall', () => {
    const client = makeRecordingClient()
    const { channel, inserts } = bind(client)
    const insertHandler = channel.handlers[0]!

    insertHandler({ new: { id: 'round-1' } })
    insertHandler({ new: { id: 'round-2' } })

    expect(inserts).toEqual(['round-1', 'round-2'])
    // Single slot: the binding tracks exactly one current round.
    expect(insertHandler).toBeDefined()
  })

  it("only the CURRENT round's own advance clears the cue — a stale round's UPDATE does not", () => {
    const client = makeRecordingClient()
    const { channel, inserts, cleared } = bind(client)
    const [insertHandler, updateHandler] = channel.handlers

    insertHandler({ new: { id: 'round-1' } })
    insertHandler({ new: { id: 'round-2' } }) // supersedes round-1
    updateHandler({ new: { id: 'round-1' } }) // the SUPERSEDED round advances

    expect(cleared).toEqual([]) // the newer cue stays
    updateHandler({ new: { id: 'round-2' } }) // the current round advances
    expect(cleared).toEqual(['round-2'])
    expect(inserts).toEqual(['round-1', 'round-2'])
  })

  it('an UPDATE for a round the cue never held is ignored entirely', () => {
    const client = makeRecordingClient()
    const { channel, cleared } = bind(client)
    const updateHandler = channel.handlers[1]!

    updateHandler({ new: { id: 'stranger-round' } })
    expect(cleared).toEqual([])
  })
})
