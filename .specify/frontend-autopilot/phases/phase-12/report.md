# Phase 12 — Report (specs/032 · Realtime, Notifications & Subscription Awareness UX)

## Final status
**DONE** — T001–T005 complete, every validation gate has a green run on the final tree,
no unresolved CRITICAL/HIGH findings, state persisted, checkpoint created.

## Objective
The awareness layer gets its central announcement policy and its honest subscription
story (Master Plan §Frontend Phase 12): one map for announcements, the cue's supersede
discipline pinned, the nearing/expired/disabled subscription states explained honestly
to the owner, and the two awareness E2E gaps closed (nearing journey, no-payload cue +
390 px) — with zero frozen anchors moved.

## Requirements → implementation summary
- **T001 (FR-07)** `announcementPolicy.ts` — the one-place map (class, dedupe key,
  now) → {surface, politeness, copy}; `shouldAnnounce` guard (1 000 ms window) +
  `resetAnnouncements`; all pinned strings moved here byte-identically. Unit 9/9.
- **T002** NewRoundCueBanner / ReconnectingBanner / shell OfflineBanner re-wired to
  source copy from the policy — zero DOM change; the frozen pins (cue line,
  'Back online — live updates restored.', reconnecting banners, retry copy) hold
  unedited; realtime.test 14/14 untouched.
- **T003 (FR-05, D5)** `SubscriptionDetailPanel` — in-flow disclosure under the banner
  (`aria-expanded`, no route, no console escape hatch) + `subscriptionCopy.ts` for the
  four states, carrying the REVERSED `platform_disabled` truth (ordering stays
  available during a manual pause; only the platform re-enables). Mounted inside the
  banner for the three non-silent states (disabled passes `state='platform_disabled'`).
  Unit 5/5.
- **T004 (FR-02)** cue supersede unit pin 3/3 — a second INSERT supersedes the visible
  announcement, only the current round's advance clears it, a foreign round's UPDATE
  is ignored.
- **T005 (D7)** `e2e/helpers/subscriptionLock.ts` (t2Lock pattern: atomic mkdir + stale
  steal) wrapping the two platform-console date journeys in platform.surfaces
  (assertions untouched) + `e2e/live.awareness.test.ts` (2): the console-driven
  nearing_expiration journey (activate → banner state → honest detail → collapse →
  restore to active via end_date +30) and the no-payload/390 px cue journey (ACK-gated
  join, exactly the fixed line + 2 affordances, no name/item/money/ids, overflow 0).

## Files changed (15 — all committed in the checkpoint)
Modified: `docs/frontend-presentation-contracts.md`, `e2e/platform.surfaces.test.ts`,
`src/components/shell/OfflineBanner.tsx`, `src/features/platform/SubscriptionBanner.tsx`,
`src/features/staffOps/components/NewRoundCueBanner.tsx`,
`src/features/staffOps/components/ReconnectingBanner.tsx`.
New: `src/features/realtime/announcementPolicy.ts`,
`src/features/platform/{subscriptionCopy.ts, SubscriptionDetailPanel.tsx,
SubscriptionDetailPanel.module.css}`, `tests/unit/{announcementPolicy,
subscriptionCopy, newRoundCue.supersede}.test.ts`, `e2e/helpers/subscriptionLock.ts`,
`e2e/live.awareness.test.ts`.
(Untracked-by-design, never committed: .agents/, .freebuff/, .specify/, .zcode/,
DESIGN.md, RestoPilot-Frontend-Master-Plan.md, specs/.)

## Backend contracts used (ALREADY_SUPPORTED — no backend change)
`private.subscription_state` derivation (never_activated/expired/nearing_expiration/
active), `get_my_subscription` (owner), `set_subscription_dates` (super admin),
`platform_disabled` flag on `public.restaurants`, realtime:cue:rounds channel.

## Validation results
- Unit: announcementPolicy 9/9, subscriptionCopy 5/5, supersede 3/3 (realtime 14/14
  untouched) — 26/26 across the four phase files.
- `npm run verify`: green across rounds on the final tree — format:check, lint,
  typecheck (`tsc -b`; `npx tsc --noEmit` does NOT check the e2e project), test:unit,
  **test:db 31 files 516/516**, **test:integration 7 files 38/38**, **build ✓**
  (environmental noise history in findings B1: shared-cloud residue/external writers,
  one self-inflicted overlap, transient 0xC0000142 worker-fork spawn failures).
- Full E2E (workers=1, timeout=90 s, db:reset before, 24.0 m): **184/187 passed**
  including both live.awareness tests and both locked platform.surfaces journeys;
  `reports.surfaces:131` (the phase-11-recorded legacy environmental spec) failed once
  and its **isolated rerun passed 6/6 (EXIT:0)** — every one of the 187 tests has a
  passing run. No frozen anchor moved in any run.
- Design/Impeccable: detail panel uses approved tokens only; disclosure is in-flow;
  390 px holds with the cue visible (overflow ≤ 0 asserted live).

## Convergence / fixes
No CRITIQUE/AUDIT/FIX loop needed beyond the findings recorded in
findings.md (F1 websocket typing gate-only, F2 'Activate' after reset, F3
whitespace-coupled assertions, F4 ACK grace; B1/B2 environmental, documented).

## Git checkpoint
`feat(032)` commit on main (baseline `6591d49`), pushed to origin/main per the
standing rule; remote verified. See state.json `git.checkpoint`.

## Remaining warnings / blocked items
None blocking. Environmental notes for future phases: (1) `npx tsc --noEmit` never
validates e2e code — gate with `npx tsc -b`; (2) `reports.surfaces:131` and
`realtime:172` remain environment-bound — isolated rerun protocol; (3) the shared
cloud DB serves live writers — confirm no process overlap before gated runs and reset
before each E2E flash.
