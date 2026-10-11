# specs/039 — Implementation Plan (Frontend End-to-End Validation)

## plan.md

### Constitution check (I–VIII)

| Principle | Verdict | Note |
|---|---|---|
| I. Design-system-first | PASS | No design work; screenshots only. |
| II. Verbatim backend contracts | PASS | Journeys assert verbatim postures (the pinned names survive); zero RPC/schema changes. |
| III. Server-enforced authorization | PASS | Denial journeys prove server-decided refusals at the UI level (no client-invented denials). |
| IV. No invented data | PASS | Zero residue (clarified); scratch tenant cleaned in-journey; seed untouched. |
| V. Determinism | PASS | Journeys deterministic on a fresh reset; injections only where documented (poisoned-cart precedent). |
| VI. Presentation-contract ledger | PASS | No pinned name moves; journeys CONSUME the ledger. |
| VII. Token discipline | PASS | No visual changes. |
| VIII. Gates | PASS | verify + the full batched e2e in ONE documented run window; summary committed. |

### Decisions (D1–D7)

- **D1 — Coverage posture (clarified)**: the connected journey + the
  state-matrix spot-checks are NEW; everything else cites standing suites
  (file + test name in `scenario-proof.md`).
- **D2 — Scratch tenant with in-journey cleanup (clarified)**: the release
  journey repeats the proven full-journey posture (scratch sign-up →
  onboarding → service → reports → cleanup), updated for the post-018
  surface (lazy chunks + the 037 vocabulary postures are the states the
  journey passes THROUGH).
- **D3 — Zero residue (clarified)**: cleanup inside the journey; the run
  summary records the residue posture.
- **D4 — Chromium only (clarified)**: the gate is the standing protocol's
  chromium project; no WebKit addition.
- **D5 — Rate-limit discipline**: one sign-in per persona per file with
  the existing helper's bounded retry; per-role files run standalone on a
  fresh reset (their serial blocks are independent).
- **D6 — Screenshots ride the same runs**: per-surface PNGs at the journey
  viewports (customer 390, staff tablet-landscape, desktop) captured from
  the journeys into `specs/039-frontend-e2e-validation/screenshots/` and
  committed (§6.6 record).
- **D7 — The proof table is the audit artifact**: `scenario-proof.md` with
  every scenario row: status (CITED file+test / NEW file+test), and the
  reviewer grep-check (each citation resolves on disk — verified by the
  T-final script).

### Architecture notes

- The connected journey file: `e2e/release.journey.test.ts` (serial,
  self-contained: signup helper reuses the full-journey pattern with the
  CURRENT onboarding surface + the 028/033-era states).
- Per-role files: `e2e/release.role-owner.test.ts`, `release.role-manager.ts`,
  `release.role-cashier.test.ts`, `release.role-kitchen.test.ts`,
  `release.role-platform.test.ts`, `release.role-guest.test.ts` — each a
  small serial file proving the persona's primary task + one denial.
- State spot-checks: asserted INSIDE the journeys as they pass through
  (skeleton seen before content, an empty posture, the offline banner
  lifecycle on the cashier leg, a verbatim refusal) or cited to `state.*`.
- Console cleanliness: ride the `gallery.error`/`F-G14` posture; the
  journey records expected-vs-unexpected console entries in the run
  summary (no blanket "zero errors" claim).

### Verification approach

- `npm run db:reset -- --yes`, then the journeys (journey + per-role files
  in ONE window respecting rate limits — batched closure per the standing
  protocol), then the standing suites batch (the 015/016/017/018 gates) —
  the run summary records the window, the batch list, and the counts.
- `npm run verify` green on the final tree.
