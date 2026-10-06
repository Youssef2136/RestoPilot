# specs/034 — Platform Console UX (Master Plan §Frontend Phase 14)

## spec.md

### Purpose
The platform owner's console becomes a deliberate operations surface: the vocabulary is
the one shared artifact, every action speaks its outcome, and the tenant list is
workable — without touching any of the five RPC contracts (Operate mode: ALREADY_SUPPORTED).

### Decisions (D1–D6)
- **D1 — One vocabulary.** The console renders subscription state labels from
  `subscriptionCopy()` (the Phase-12 owner-facing artifact) — the local `STATE_LABELS`
  map is deleted; `platform_disabled` keeps its distinct console rendering (Disabled +
  reason) per the P12 contract (the disabled presentation is console-specific: flag +
  reason text, not the owner banner).
- **D2 — Every action speaks (FR-07).** Dates saved, tenant disabled, tenant
  re-enabled, and onboarding success each surface a `useToast` outcome (success copy
  names the restaurant) on top of the existing refresh invalidation. Refusals stay
  verbatim (FR-08 unchanged).
- **D3 — Sort + filter on the tenant table (FR-02).** A name filter input (substring,
  case-insensitive) + sortable Name and Subscription columns via the DataTable sort
  pattern (aria-sort buttons, client-side over the already-fetched overview rows —
  no new reads, FR-10 holds).
- **D4 — Dates validation feedback (FR-03).** The dates form validates end ≥ start
  inline (error line under the field, submit guarded) — server errors still render
  verbatim when they fire.
- **D5 — Console landing posture (FR-01).** `/admin` gains the platform posture
  summary (tenants count, disabled count, a one-line capability statement) rendered
  from the SAME overview query the console uses — no second fetch, no tenant data
  beyond the overview.
- **D6 — Responsive + a11y floor.** The console table adopts the shared card-fallback
  CSS pattern (labelled `data-label` cells < 720px); both `/admin` routes join the axe
  baseline and the 390px overflow assertion in the phase E2E.

### Out of scope (frozen contracts)
`get_platform_overview` shape, `set_subscription_dates` validation, disable semantics,
`onboard_restaurant` behavior, no auto-disable on expiry, no tenant data beyond the
overview, no billing. The frozen `platform.surfaces` assertions hold verbatim EXCEPT
the two 'Never activated' pins: D1 moves the console's never-activated label to the
P12 vocabulary ('Not activated yet'), so those two pins are MIGRATED in the same
commit per the Master Plan exit criterion ("preserved or migrated with a record") and
the Category-A change discipline (documented here, paired tests updated together,
justified, validated). 'Active'/'Expired'/'Disabled' texts are byte-identical in
`subscriptionCopy` — nothing else moves.

## plan.md

| Aspect | Decision |
|---|---|
| Routes | /admin (D5 posture), /admin/platform (D1-D4) — unchanged |
| Components | TenantTable (extracted), SubscriptionStatePill (D1), DatesDialog stays inline form + D4 validation, SortHeader buttons, Card-fallback css shared |
| State/data flow | existing usePlatformOverview/useSetSubscriptionDates/useSetPlatformDisabled/useOnboardRestaurant — only the RENDER changes + toasts (D2) |
| Backend | NOT_REQUIRED — five RPCs verbatim |
| Testing | unit: stateLabel helper (D1) + posture summary (D5); E2E `e2e/platform.console.test.ts` (3): sort/filter, toasts on dates+disable+re-enable (locked), 390px cards + axe on both routes |
| Frozen | platform.surfaces 7/7 verbatim; platform.test unit 14/14 preserved (extended) |

## tasks.md

| # | Task | Covers | Status |
|---|---|---|---|
| T001 | D1 vocabulary unification: `stateLabel(state)` helper in subscriptionCopy.ts (wraps label), console renders it, STATE_LABELS deleted | FR/UX | [x] |
| T002 | D2 toasts: dates saved / disabled / re-enabled / onboarded outcomes via useToast (restaurant-named copy) | FR-07 | [x] |
| T003 | D3 sort+filter: name filter + sortable Name/Subscription (aria-sort, client-side) | FR-02 | [x] |
| T004 | D4 dates validation: end ≥ start inline error + guarded submit | FR-03 | [x] |
| T005 | D5 landing posture on /admin from the shared overview query | FR-01 | [x] |
| T006 | D6 card fallback css + 390px/axe coverage; new E2E platform.console.test.ts (3) | R/A11y | [x] |

## checklists/requirements.md

- R1 (FR-07) every action outcome surfaced — T002, E2E.
- R2 (FR-02) sortable/filterable tenant table — T003, E2E.
- R3 (FR-03) dates validation feedback — T004, unit+E2E.
- R4 (UX) vocabulary consistency with P12 — T001, unit.
- R5 (FR-01) console landing posture — T005, E2E.
- R6 (A11y/Responsive) cards + axe on both admin routes — T006, E2E.

## analysis.md

No contradictions: D1 reuses the committed P12 artifact (dependency narrowed exactly as
the Master Plan documents); D3 is client-side over the existing payload (FR-10 intact);
Backend NOT_REQUIRED.

**Correction during implementation (kept for the record):** the earlier claim that the
frozen suite's asserted texts are byte-identical under D1 missed two pins —
`e2e/platform.surfaces.test.ts` asserts the console renders 'Never activated' twice
(the overview list test and the onboarding coherence step). D1 unifies the vocabulary
on `subscriptionCopy`, whose never-activated label is 'Not activated yet', so those
pins necessarily move. Migration executed per the change discipline: documented here
and in the §Phase 034 ledger record, paired pin updates in the same commit, unit
coverage locking the new label (`stateLabel`), and both suites validated green. The
suite's remaining texts ('Active'/'Expired'/'Disabled', banner states, denial) are
byte-identical under D1.
