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

> Normalized 2026-10-06: the embedded plan/tasks/checklists/analysis sections moved
> to standalone files (the 031/032 pipeline layout). Content verbatim; evidence
> columns in `tasks.md` added from the recorded green runs. Implementation stands at
> `9dba5d3`; no pipeline step re-run (one convergence round, C001, recorded in
> `tasks.md`).
