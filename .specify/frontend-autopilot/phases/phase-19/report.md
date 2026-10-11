# Phase 19 — Report (specs/039 · Frontend End-to-End Validation)

## Final status

**DONE — converged (first round)** — T001–T014 complete, the final
`npm run verify` green (EXIT=0) on the final tree, the batched Playwright
window closed with ZERO failures (journey+roles 10/10 in one 2.2 m window,
the state batch 43/43, the standing suites zero failures), the
scenario→proof table 26/26 resolvable, nothing committed (commit
convention: `test(039): …`, at the user's word).

## Objective

The frontend's dress rehearsal (master plan §Frontend Phase 19, validate
mode): ONE connected multi-role journey on a scratch tenant, six
independently-rerunnable per-role proof files, the scenario→proof table
with zero silent gaps, and the release candidate's standing gates green in
one documented window — with friction recorded, never fixed, and zero
residue.

## Deliverables

- **The connected journey (US1/FR-01)**: `e2e/release.journey.test.ts`
  4/4 — scratch-tenant owner signup → onboarding → entry → two rounds →
  cashier accept/start/ready/lock → kitchen ticket path → bill view → the
  VERBATIM void_round refusal (documented injection at the CONFIRM click,
  prompt survival + explicit retry) → void lands → offline banner
  lifecycle on the cashier leg → reports + audit → in-journey cleanup
  (co-owner added, Fiona removed = the seed posture restored). 8
  per-surface PNGs (SC-004) captured in the SAME run at customer
  390×844, tablet 1112×834, desktop 1440×900.
- **The per-role suite (US2/FR-02)**: `e2e/release.role-{owner,manager,
  cashier,kitchen,platform,guest}.test.ts` — each persona's primary task
  + a denial (out-of-scope deep link / rounds-surface denial / injected
  verbatim refusal / console staff-area boundary / invalid-token
  isolation). 6/6 standalone AND 10/10 combined with the journey in one
  2.2 m window after db:reset.
- **The scenario→proof table (US3/FR-03/FR-04)**:
  `specs/039-frontend-e2e-validation/scenario-proof.md` — 26 rows, every
  row CITED (file › test) or NEW; `scripts/verify-scenario-proof.mjs`
  wired as `npm run verify:scenario-proof` — "26 rows scanned / every
  citation resolves (no silent gaps)".
- **The documented window (US4/FR-06)**:
  `specs/039-frontend-e2e-validation/run-summary.md` — the 6-batch
  ledger, console expected-vs-unexpected (injected 400s + slug
  collisions expected; unexpected NONE), zero-residue posture, gate
  verdicts — including the HONEST record of one polluted db-tier attempt
  (staff.management transaction-abort cascade, 3/516) and its mandated
  `db:reset` → rerun treatment landing green, then the full-gate rerun
  EXIT=0.
- **Manual a11y spots (T014)**: `manual-a11y.md` — four journeys
  (guest order cue, cashier refusal announce, kitchen money-free
  hand-off, offline/refusal honesty) all clean; the machine matrix stays
  the enforcement layer.
- **Docs**: `docs/conventions.md` §The validation phase ledger (spec 039)
  — the standing validation protocol for future phases.

## Debug ledger (honesty notes)

- Three lint errors surfaced at the first full verify: a useless catch
  wrapper around the tenant-creation block (unwrapped), an unused
  `browser` fixture in the void/offline leg, an unused `Page` import in
  the guest role file — all fixed, no test bodies weakened (FR-05 held).
- The Marina kitchen role leg's real-lesson reuse: Marina has NO cashier
  — a new Marina round sits in 'Awaiting cashier' with no Start-prep
  button; the OWNER accepts through HER rounds board after switching the
  Branch combobox to 'Blue Olive — Marina'. Recorded in T007's done
  note; friction recorded, NOT fixed (validate mode).
- The guest history loop initially raced the 10 s poll window —
  rewritten with poll-bounded 20 s waits; token isolation asserts via
  the INVALID token (dev demo tokens are live sessions).
- The full verify poll cadence exceeded the tool's default window once
  (timeout, not failure); rerun to completion EXIT=0.

## Gates

| Gate | Result |
|---|---|
| `npm run verify` (final tree) | ✅ EXIT=0 (format clean; lint 0 errors / 29 pre-existing react-refresh warnings; tsc clean; unit 454/454; db 516/516 after db:reset; integration 38/38; build 2.66 s) |
| Playwright release window (db:reset before every batch, chromium, workers 1) | ✅ ZERO failures — journey 4/4; journey+roles 10/10 (2.2 m); state batch 43/43 (5.2 m); standing suites zero failures |
| `npm run verify:scenario-proof` | ✅ 26 rows scanned / every citation resolves |
| SC checklist | SC-001 ✅ one-window pass · SC-002 ✅ zero unresolved rows · SC-003 ✅ a11y/responsive/console green (expected-vs-unexpected recorded) · SC-004 ✅ 8 viewports committed · SC-005 ✅ verify green + run summary committed |
| 015/016/017/018 carry-forward | UNMODIFIED, green (coverage-notes: zero drift) |

## Convergence

First round, zero gaps. No convergence tasks appended; the recorded
friction (Marina cashier absence) belongs to its owning phase, not a 039
fix.

## Boundary

Nothing committed or pushed (checkpoint convention: `test(039): …` awaits
the user's word). No product features added, no redesign, no backend
coverage, no schema changes (Out of Scope held).
