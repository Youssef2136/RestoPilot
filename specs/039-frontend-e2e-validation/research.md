# specs/039 — Research

## R1 — The existing coverage inventory (what the standing suites already prove)

The phase-18 sweep is the standing proof inventory (all green, batched):
- Connected service journey: `full-journey.test.ts` (3) — scratch tenant
  (harbor-owner signup → onboarding → entry → rounds → bill/close →
  reports/audit).
- Realtime: `realtime.test.ts` (6) + `live.awareness.test.ts` — arrival,
  money-free kitchen, live cue, reload reconcile.
- Notifications/cue: `live.awareness.test.ts` + the 032 surfaces.
- Responsive: `responsive.*` (12 + the a11y.matrix carried rows) + device
  contracts.
- Accessibility: `a11y.matrix.test.ts` (31), `touch.targets` (3),
  `keyboard.journeys` (4), `motion.preferences` (3).
- Performance smoke: `perf.customer/boards/trails` (5).
- State matrix: `state.operations/reads/customer/expiry.partial` (12).
- Console cleanliness: `gallery.error.test.ts` (F-G14 posture).
- Platform/subscription: `platform.surfaces+console`, `live.awareness`
  (disable/enable journey).
- Denials: `auth.routes` + each suite's denial legs + the 037 expiry legs.

## R2 — What is genuinely MISSING (the new coverage)

1. **THE CONNECTED JOURNEY post-018**: `full-journey` predates the 037/038
   surfaces (it predates the split, the state vocabulary, the OfflineSurface
   posture, and the a11y matrix). The phase needs its OWN release journey
   proving the CURRENT candidate in one connected story (and it must NOT
   modify full-journey — the citation posture keeps the standing suite
   untouched).
2. **Per-role isolated rerunnability**: today's suites are surface-oriented;
   the six-persona ONE-FILE-EACH isolation is new.
3. **The per-role denial spot rows** (a deep-link denial per role in one
   small file each).

## R3 — The scratch-tenant journey mechanics (proven precedent)

`full-journey.test.ts` already demonstrates: signup (a unique e2e-harbor
owner identity), the onboarding surface, the entry flow, rounds, bill/close,
reports/audit on the scratch tenant, and the in-journey cleanup (the
035-era record fixed the no-residue posture). The release journey reuses
the SAME pattern with the CURRENT UI (post-018 states are what it passes
through — the skeleton/empty/role-denial postures met on the way are the
state spot-checks, asserted in passing).

## R4 — Rate-limit window (§12.5)

One sign-in per persona per file; the connected journey signs in exactly
the journey's personas (owner-by-signup needs NO seed sign-in; the guest is
unauthenticated). The per-role files each sign in their ONE persona. The
batched protocol already respects the window.

## R5 — Console cleanliness (F-G14)

Expected-vs-unexpected: the journeys record console entries and classify
them (expected: the deliberate injected-refusal 400s; unexpected: anything
else). The artifact is the run summary's console section — no blanket
"zero errors" claim.

## R6 — Screenshots record (§6.6)

Captured per surface at the journey's real viewports (customer 390×844,
tablet landscape 1112×834, desktop 1440×900), committed under
`screenshots/` — the release candidate's visual record.
