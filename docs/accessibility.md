# Accessibility — the floor, the matrix, and the keyboard maps (spec 035)

RestoPilot's accessibility posture is a **verified property**, not a styling note:
an automated axe floor (WCAG 2.2 AA automatable subset — spec 021 Clarification Q2,
confirmed at spec 035 clarify), a route×state matrix over every registered route in
its authorized state, keyboard-complete critical journeys with focus assertions, and
a reviewed exceptions record (`specs/035-accessibility-hardening/audit/exceptions.md` — every unfixed finding
carries a reason and an owner; serious-plus findings are always fixed).

## Where the proofs live

| Proof                                                                                                                                                          | Where                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The axe floor helper + committed baseline                                                                                                                      | `e2e/helpers/a11y.ts` (findings are never silently waived; entries need a written justification + owning phase) |
| The baseline sweep (signed-out routes)                                                                                                                         | `e2e/a11y.baseline.test.ts`                                                                                     |
| The route×state matrix (31 rows: public, per-role staff, denial views, the Fiona bootstrap, the 404) + shell floor (one `#main`, skip link first in Tab order) | `e2e/a11y.matrix.test.ts`                                                                                       |
| The session-gated menu floor                                                                                                                                   | `e2e/customer.menu.test.ts` (spec 025)                                                                          |
| Keyboard journeys (customer ordering, mobile drawer, session close, onboarding)                                                                                | `e2e/keyboard.journeys.test.ts`                                                                                 |
| Keyboard walks with focus rules (cashier chain + void dialog, kitchen walk + live no-steal)                                                                    | `e2e/cashier.operations.test.ts`, `e2e/kitchen.display.test.ts`                                                 |
| The audit record (findings F-00x, walkthrough results, contrast record)                                                                                        | `specs/035-accessibility-hardening/audit/`                                                                      |

## The keyboard maps

These are the documented keyboard operability contracts for the operational surfaces
(FR-03). Everything below is proven by the named E2E specs — a change that breaks a
row here breaks a test.

### Cashier — `/dashboard/rounds` (proven by `cashier.operations.test.ts`)

| Action                                               | Keys                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move focus                                           | `Tab` / `Shift+Tab` (board order follows the state groups: New → In preparation → Ready → Locked)                                                                                                                                           |
| Accept / Start preparation / Mark ready / Lock round | focus the button, `Enter`                                                                                                                                                                                                                   |
| Show bill (per-card checkbox)                        | focus, `Space` — the bill fetch never steals focus                                                                                                                                                                                          |
| Void round                                           | focus, `Enter` → the confirm dialog opens with focus inside; `Escape` cancels and restores focus to the trigger; type the reason into 'Void reason', then focus 'Confirm void' + `Enter` (the confirm stays disabled until a reason exists) |
| Live updates                                         | realtime refetches/re-renders NEVER move focus (proven across a full poll cycle)                                                                                                                                                            |

### Kitchen — `/dashboard/kitchen` (proven by `kitchen.display.test.ts`)

| Action                         | Keys                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Read the board                 | three labelled columns (`Incoming (awaiting cashier)` / In preparation / Ready); the freshness badge announces updates politely |
| Start preparation / Mark ready | focus the ticket's button, `Enter` (the walk is keyboard-only end-to-end)                                                       |
| Live updates                   | arrivals/reloads never move focus (proven across a full poll cycle); a new ticket announces once via the polite counter region  |

### The overlays (both surfaces + every confirm)

`Dialog` (native `<dialog>`): focus is trapped by the browser, `Escape` closes via
`cancel`, focus restores to the opener on close; the destructive-confirm pattern
always pairs the danger action with an explicit cancel. `Drawer` (the mobile nav):
focus moves in on open, `Tab` cycles within the panel, `Escape` closes and restores
to the opener. Both contracts are pinned by `keyboard.journeys.test.ts`.

### The shells

The skip link ('Skip to main content') is the FIRST thing in tab order on both shells
and jumps to `<main id="main">` — proven on every matrix row. The staff mobile drawer
(390px) is keyboard-complete: open → contained → `Escape` → restore.

## Rules for future phases

1. New interactive surfaces must keep every row of these maps true (and add rows for
   their own actions, with a proving spec).
2. A rename of any accessible name that a spec pins is a **Category-A** change
   (docs/frontend-presentation-contracts.md): paired tests updated in the same commit,
   ledger-recorded, justified.
3. New axe findings are fixed (serious-plus) or recorded with a reason and an owner in
   `specs/035-accessibility-hardening/audit/exceptions.md` — never silently waived.
4. Phases 16–20 re-run the a11y matrix after layout/responsive work (the Master
   Plan's standing exit criterion).
