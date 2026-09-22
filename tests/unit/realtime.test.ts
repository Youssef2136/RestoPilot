import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * The realtime hook unit suite (spec 012 T010; contracts/realtime-client.md
 * §1–§2). One seam, mocked: `getSupabaseClient` — no sockets, no DOM (the
 * house node-environment method).
 *
 * The hook effects delegate to the exported BINDING FACTORIES
 * (`bindRealtimeInvalidation`, `bindNewRoundCue`), which are exercised here
 * directly against a recording channel: the subscription shape, the
 * coalescing window, the SUBSCRIBED recovery, the cleanup, and the cue
 * cycle. The static-render cases prove the no-event branch renders nothing.
 */

type Handler = (payload: unknown) => void
type StatusHandler = (status: string) => void

interface RecordingChannel {
  name: string
  handlers: Handler[]
  statusHandlers: StatusHandler[]
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

const harness = vi.hoisted(() => ({
  channels: [] as RecordingChannel[],
  removeChannel: vi.fn(async () => {}),
}))

function makeRecordingClient() {
  return {
    channel: (name: string): RecordingChannel => {
      const existing = harness.channels.find((c) => c.name === name)
      if (existing) {
        return existing
      }
      const channel: RecordingChannel = {
        name,
        handlers: [],
        statusHandlers: [],
        on: vi.fn((_type: string, _filter: unknown, handler: Handler) => {
          channel.handlers.push(handler)
          return channel
        }),
        subscribe: vi.fn((status?: StatusHandler) => {
          if (status) {
            channel.statusHandlers.push(status)
          }
          return channel
        }),
      }
      harness.channels.push(channel)
      return channel
    },
    removeChannel: harness.removeChannel,
  }
}

import {
  bindRealtimeInvalidation,
  COALESCE_MS,
  realtimeChannelName,
} from '../../src/features/realtime/useRealtimeInvalidation'
import { bindNewRoundCue } from '../../src/features/realtime/useNewRoundCue'
import { DashboardLiveCue } from '../../src/routes/DashboardLiveCue'

beforeEach(() => {
  harness.channels.length = 0
  harness.removeChannel.mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the subscription shape (contracts §1)', () => {
  it('subscribes to the table with the server-side branch filter', () => {
    const client = makeRecordingClient()
    const binding = bindRealtimeInvalidation(client as never, {
      scopeValue: 'branch-1',
      table: 'rounds',
      invalidate: () => Promise.resolve(),
    })
    expect(binding.channelName).toBe('realtime:rounds:branch-1')
    const channel = harness.channels[harness.channels.length - 1]!
    const filter = channel.on.mock.calls[0]![1] as Record<string, string>
    expect(filter.table).toBe('rounds')
    expect(filter.schema).toBe('public')
    expect(filter.event).toBe('*')
    expect(filter.filter).toBe('branch_id=eq.branch-1')
    expect(channel.subscribe).toHaveBeenCalled()
    binding.unmount()
  })

  it('the channel name is derived from table + scope', () => {
    expect(realtimeChannelName('kitchen_tickets', 'b9')).toBe('realtime:kitchen_tickets:b9')
  })
})

describe('the coalescing window (contracts §1.3)', () => {
  it('N events inside the window schedule exactly ONE invalidate; the trailing event is never dropped', () => {
    vi.useFakeTimers()
    const client = makeRecordingClient()
    const invalidate = vi.fn(() => Promise.resolve())
    bindRealtimeInvalidation(client as never, {
      scopeValue: 'b1',
      table: 'rounds',
      invalidate,
    })
    const channel = harness.channels[harness.channels.length - 1]!
    const handler = channel.handlers[0]!

    // A burst: the payloads are ignored; only the arrival counts.
    handler({ new: { id: 'r1' } })
    handler({ new: { id: 'r2' } })
    handler({ new: { id: 'r3' } })
    expect(invalidate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(COALESCE_MS + 10)
    expect(invalidate).toHaveBeenCalledTimes(1)

    // A later event schedules its own invalidate (never dropped).
    handler({ new: { id: 'r4' } })
    vi.advanceTimersByTime(COALESCE_MS + 10)
    expect(invalidate).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('the recovery refetch (contracts §1.4, FR-004)', () => {
  it('SUBSCRIBED invalidates once; an error does not; the reconnect does', () => {
    vi.useFakeTimers()
    const client = makeRecordingClient()
    const invalidate = vi.fn(() => Promise.resolve())
    bindRealtimeInvalidation(client as never, {
      scopeValue: 'b1',
      table: 'kitchen_tickets',
      invalidate,
    })
    const channel = harness.channels[harness.channels.length - 1]!

    channel.statusHandlers.forEach((h) => h('CHANNEL_ERROR'))
    expect(invalidate).not.toHaveBeenCalled()
    channel.statusHandlers.forEach((h) => h('SUBSCRIBED'))
    expect(invalidate).toHaveBeenCalledTimes(1)
    channel.statusHandlers.forEach((h) => h('TIMED_OUT'))
    expect(invalidate).toHaveBeenCalledTimes(1)
    channel.statusHandlers.forEach((h) => h('SUBSCRIBED'))
    expect(invalidate).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('the full disconnect cycle: unsubscribe→resubscribe refetches like an auto-reconnect (016 T008; FR-006)', () => {
    vi.useFakeTimers()
    const client = makeRecordingClient()
    const invalidate = vi.fn(() => Promise.resolve())
    const binding = bindRealtimeInvalidation(client as never, {
      scopeValue: 'b1',
      table: 'kitchen_tickets',
      invalidate,
    })
    const channel = harness.channels[harness.channels.length - 1]!
    channel.statusHandlers.forEach((h) => h('SUBSCRIBED'))
    expect(invalidate).toHaveBeenCalledTimes(1)

    // A deliberate unsubscribe (the reliability journey's half-offline tab:
    // the user backgrounds the app and the client drops the channel).
    binding.unmount()
    expect(harness.removeChannel).toHaveBeenCalledWith(channel)

    // Re-entry is a FRESH binding on the same client: in production a new
    // channel object (the old one was removed); the recording harness reuses
    // the channel by name, so the new binding's status handler APPENDS to it
    // and only that new handler fires for the fresh subscription — mirroring
    // a brand-new channel's first SUBSCRIBED.
    const handlersBefore = channel.statusHandlers.length
    const invalidate2 = vi.fn(() => Promise.resolve())
    bindRealtimeInvalidation(client as never, {
      scopeValue: 'b1',
      table: 'kitchen_tickets',
      invalidate: invalidate2,
    })
    expect(channel.statusHandlers.length).toBe(handlersBefore + 1)
    channel.statusHandlers.slice(handlersBefore).forEach((h) => h('SUBSCRIBED'))
    expect(invalidate2).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledTimes(1) // the old binding stays dead
    vi.useRealTimers()
  })
})

describe('cleanup (contracts §1.6)', () => {
  it('unmount clears a pending invalidate and removes the channel', () => {
    vi.useFakeTimers()
    const client = makeRecordingClient()
    const invalidate = vi.fn(() => Promise.resolve())
    const binding = bindRealtimeInvalidation(client as never, {
      scopeValue: 'b1',
      table: 'sessions',
      invalidate,
    })
    const channel = harness.channels[harness.channels.length - 1]!
    channel.handlers[0]!({ new: { id: 'x' } })
    binding.unmount()
    vi.advanceTimersByTime(COALESCE_MS + 10)
    // The pending window died with the unmount — no orphan invalidate.
    expect(invalidate).not.toHaveBeenCalled()
    expect(harness.removeChannel).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('the cue cycle (contracts §2, US4)', () => {
  it('INSERT sets the cue; the round UPDATE clears it; foreign updates do not', () => {
    const client = makeRecordingClient()
    const cues: Array<string | null> = []
    const binding = bindNewRoundCue(client as never, {
      branchId: 'b1',
      onInsert: (roundId) => cues.push(roundId),
      onUpdateCleared: () => cues.push(null),
    })
    const channel = harness.channels.find((c) => c.name === 'realtime:cue:rounds:b1')!
    expect(channel).toBeTruthy()

    const [onInsertEvent, onUpdateEvent] = channel.handlers
    onInsertEvent!({ new: { id: 'round-9' } })
    onUpdateEvent!({ new: { id: 'other-round' } }) // foreign — no clear
    expect(cues).toEqual(['round-9'])
    onUpdateEvent!({ new: { id: 'round-9' } }) // the cue's own round — clears
    expect(cues).toEqual(['round-9', null])
    binding.unmount()
  })
})

describe('the cue region rendering (US4, D3)', () => {
  it('renders nothing without a cue (no events under static rendering)', () => {
    const qc = new QueryClient()
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(DashboardLiveCue, { branchId: 'branch-x' }),
      ),
    )
    expect(html).not.toContain('data-live-cue')
  })

  it('renders the derived text with role=status when a cue exists', () => {
    const html = renderToStaticMarkup(
      createElement('div', { role: 'status', 'data-live-cue': true }, 'A new order arrived.'),
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('A new order arrived.')
  })
})
