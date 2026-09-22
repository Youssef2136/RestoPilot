# Quickstart: Branch Reports (Phase 12)

**Feature**: `013-branch-reports` | [Spec](spec.md) | [Plan](plan.md) |
[Tasks](tasks.md)

## What shipped

Owner/manager operational reporting over the captured substrate (master plan
§23): daily/weekly/monthly aggregates, branch comparison, best sellers,
channel breakdown, and the void log — derived at read time, never stored
twice.

## Try it (5 minutes)

1. **Reset to the deterministic fixture**: `npm run db:reset -- --yes`
2. **Start the app**: `npm run dev`, sign in as `alice@restopilot.dev` /
   `dev-alice-2026`
3. **Reports**: `/dashboard/reports` — pick a branch and period; the
   aggregates grid, channel table (all three channels, zeros included), and
   best sellers render. With two branches the comparison table sits below.
4. **Void log**: `/dashboard/voids` — voids made through the cashier surface
   (round driven to its channel's void boundary → Void round → reason)
   appear with who/when/why and the captured total.
5. **Manager view**: sign in as `bob@restopilot.dev` — the same pages render
   scoped to Downtown, with no branch picker and no comparison.
6. **Cashier/kitchen**: `carla`/`dan` deep-linking either route get the
   explicit denial; their navigation lists neither entry.

## Scripted walkthroughs

```bash
node --env-file-if-exists=.env scripts/run-reports-walkthroughs.mjs
```

Real sign-ins (alice/bob/carla), two rounds through the real anon submission
RPC, one round driven to the void boundary and voided as carla — then the
reconciliation and reach checks, and a state restore at the end.

## Validation record (2026-09-22)

**11/11 walkthrough checks PASS** against the live development project:

- A1 two rounds submitted through the real path
- A3 owner reads the day report
- A4 net total drops by exactly the voided round (delta −39.20 = the voided
  round's captured total — the overlay proof, computed against the SQL hand
  derivation)
- A5 rounds_voided counted (+1)
- A6 channels list all three with explicit zeros
- A7 void log carries who/why/captured (Carla + reason verbatim)
- B1 manager reads their own branch over the wire
- B2 manager own-branch baseline ok
- B3 cashier refused with 42501
- B4 anon refused (no existence leaks)
- B5 unknown period refused with P0001

The script restores deterministic state on success (`db:reset --yes`).
