# Implementation Plan: 035-accessibility-hardening (Frontend Phase 15)

**Mode**: Operate/Read (audit) · **Baseline**: `c554f03` · **Backend impact**: NOT_REQUIRED —
no RPC, type, RLS, or authorization change anywhere (a11y fixes disclose nothing new)

> House layout (031–034): plan/research/quickstart + no data-model.md/contracts/ — this
> phase introduces no runtime data entities (its "entities" are the audit artifacts,
> documented in research.md R6). quickstart.md IS required here (the spec mandates the
> five recorded walkthrough scripts).

## Constitution Check
- **I Business Scope** — no product scope added; accessibility fixes only. PASS.
- **II Specs are truth** — the phase hardens against the ALREADY-BUILT surfaces; no
  business rule is invented; findings are fixed or recorded, never silently changed. PASS.
- **III/IV Isolation & server authorization** — untouched; improved denial views disclose
  nothing new (spec Security note; E2E denial pins keep passing). PASS.
- **V/VI/VII DB/state/audit** — no DB or state-transition surface touched. PASS.
- **VIII YAGNI** — no new tooling: the Phase-01 a11y helper is EXTENDED, not replaced; no
  charting/dependency-style additions. PASS.

## Aspect decisions

| Aspect | Decision |
| --- | --- |
| Routes | ALL registered routes audited in their authorized state (~23 paths: public `/`, `/signin`, `/reset-password`; customer `/r/:slug`, `/r/:slug/menu`, `/order/:branchId`; staff dashboard 12 + branch detail/menu/tax; `/admin`, `/admin/platform`) — no route additions |
| Components | No new runtime components planned. Central fixes only where audits converge: `Dialog.tsx`/drawer focus containment+restore (if found missing), target-size/contrast CSS token fixes, `ItemCard`/cart micro-buttons (the A3 finding). Test-only: the route×state axe runner extends `e2e/helpers/a11y.ts` |
| State/data flow | Unchanged — audits + presentation-attribute/CSS fixes only; no query, RPC, or auth changes |
| Backend | NOT_REQUIRED — verbatim contracts; denial data disclosure unchanged |
| Testing | E2E: expanded axe matrix (route × authorized state, incl. mobile/tablet rows + preferences emulation: reduced-motion, forced-colors, 200% zoom); NEW keyboard-journey specs (customer ordering, session close, onboarding) + focus containment/restore assertions added to the proven cashier/kitchen walks; live-region announcements encoded per the 032 policy. Unit: announcement-policy coverage. Manual: five walkthrough scripts (quickstart) |
| Frozen | Every existing E2E pin (labels, names, live-region texts, denial copies) holds verbatim — any rename is Category-A (ledger-recorded, paired tests in the same commit). The axe baseline stays EMPTY except owned entries with written justification + owner phase 035 |

## Key decisions (D1–D7)
- **D1 — Findings policy (clarified).** Every critical/serious finding is FIXED this
  phase; moderate/minor may be recorded in the exceptions list with reason + owner.
  The axe baseline records only owned, justified entries.
- **D2 — Keyboard proof.** New keyboard-only E2E for customer ordering, session close,
  and onboarding; the existing cashier/kitchen keyboard walks gain dialog/drawer focus
  containment + trigger-restore assertions (FR-04).
- **D3 — Live-region policy.** Audited against `features/realtime/announcementPolicy.ts`
  (032): announcements announce once, politely, with the agreed copy; corrections land
  in code + unit tests; nothing steals focus on live updates.
- **D4 — Contrast record.** Every token pair in use gets a documented result
  (pass / owned exception) in `specs/035-accessibility-hardening/audit/contrast.md`; automatable failures ride
  axe color-contrast; the table is the standing record.
- **D5 — Targets & motion.** Touch-target audit at mobile+tablet (the 031 A3 cart
  micro-buttons finding is the first owned item); reduced-motion verified against the
  existing CSS blocks; forced-colors audited via emulation and recorded per clarify.
- **D6 — Landmarks & names.** Skip links + landmarks verified on both shells (incl. the
  mobile drawer's keyboard behavior); accessible names cross-checked against the
  presentation ledger; zoom-200% checks on the critical journeys.
- **D7 — The audit record.** `specs/035-accessibility-hardening/audit/` holds `report.md` (findings: severity,
  decision, evidence) and `exceptions.md` (reason + owner per row); the keyboard maps
  for cashier/kitchen land in `docs/` (FR-03).
