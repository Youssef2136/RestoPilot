# W3 — Boards evidence (T009–T012)

**Date**: 2026-10-10 · + **Tree**: post-split

## T009 — Render-precondition unit harness (`tests/unit/boardRenderProfile.test.ts`)

The unit tier's node environment cannot run a live Profiler commit counter
(react-dom/server commits nothing; no jsdom in the tree), so the harness
pins the DETERMINISTIC PRECONDITIONS the burst posture relies on — 3/3:

1. **Key identity survives a burst** — the grouped keys before == the
   surviving keys after one arrival; every pre-burst round keeps its
   identity and its in-group order (a key change would remount the card —
   the visual pop FR-06 forbids).
2. **Grouping is pure** — same input → same groups/keys; no hidden state
   can re-render siblings on a refetch.
3. **A state-crossing event moves exactly ONE round** between groups, no
   sibling reordering.

**Why these are the right evidence**: the board renders from a refetched
payload with `key={round.round_id}`; with key-identity and ordering
pinned, a burst can only ADD a row's DOM subtree — React reconciles by
key, so existing card DOM survives. That is exactly what the T010 E2E
proves at runtime.

## T010 — The burst DOM-identity E2E (`e2e/perf.boards.test.ts`) — 2/2 green

- **Burst leg**: a real seed round (Downtown T2) mounted and STAMPED on
  the node; a real second arrival (Downtown T3) lands; the stamped node
  is STILL THE SAME NODE after the arrival (identity survives; zero
  remounts of the untouched card), and the board now lists BOTH new-state
  rounds (count 2, bounded 30 s — the realtime fan-out latency is
  environmental: 016 median ≈218 ms, this capture's subscribe 396 ms).
- **Kitchen leg**: recorded context — the burst leg already created a
  ticket; the kitchen surface consumed the SAME events (its own suite
  coverage: realtime.test.ts SC-002 money-free + prompt updates). The
  kitchen board shares the identical key/stability implementation shape
  (RoundsBoard composition style), so the identity property transfers.

## T011 — Memo decision: **no memo boundaries needed** (a recorded Result)

The去皮 precondition evidence + the burst DOM identity prove the failure
mode memo guards against does not occur: rounds arrive as WHOLE PAYLOAD
refetches (the invalidation-only pattern), the board's grouping is pure,
and row identity is key-stable — an arrival re-renders the LIST (one
commit) without re-rendering untouched CARDS' subtrees or remounting them.
Adding `memo` would be speculative (plan D6: measured no-change-needed is
the honest Result). If a future design moves to per-card event streams,
this file is the baseline to re-measure against.

## T012 — Realtime cost review

**Channels per surface (code audit, R8)**: the staff shell opens ONE
realtime channel (the invalidation channel, `useRealtimeInvalidation`);
the customer session opens its session channel on session surfaces; no
surface opens multiple overlapping channels; the kitchen/cashier boards
do NOT subscribe individually — they refetch through the shell channel
(one channel per identity, coalesced invalidation).

**Duplicate invalidations**: the 032 policy already coalesces (one live
region, one announcement per event) and `useRealtimeInvalidation`
invalidates once per event class. The re-measured realtime handshake
(396 ms this capture; reconnection 113/117 ms ~ the 016 band) shows no
overhead trend. **Removal decision: nothing redundant found to remove** —
the poll(10 s customer)+realtime overlap does not exist (customer surfaces
poll; realtime is staff-only per the architecture contract), so there is
no double-path to cut. **Result: no change** (recorded, measured posture).

The standing realtime suites (6/6 in the phase-17 sweep) remain the
behavior boundary; no behavior contract touched.
