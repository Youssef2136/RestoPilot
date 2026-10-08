# Quickstart — 035-accessibility-hardening

> Validation order matters: **`npm run db:reset` before ANY E2E run** (the db/integration
> suites leave tenant-flag/date residue on the shared cloud DB — recorded since Phase 14),
> then targeted specs, then `npm run verify`.

## Automated gates (after implementation)
1. `npm run verify` — format/lint/tsc/unit 430+/db/integration/build green.
2. `npm run db:reset` → `npx playwright test --project=chromium` — the expanded a11y
   matrix green: zero unwaived axe findings on every scanned route×state; the keyboard
   journeys (customer, session close, onboarding) green; focus containment/restore
   assertions green on the proven cashier/kitchen walks.
3. Mobile/tablet rows: the target-size and overflow checks green at 390×844 and 834×1112.

## Manual walkthroughs (the five recorded scripts)

Recorded walkthroughs run with each platform's built-in screen reader (Windows/NVDA,
macOS/VoiceOver) at the default settings; each script lists the steps and the expected
announcements. Recording = executing the script and noting pass/fail per expected line
in `specs/035-accessibility-hardening/audit/report.md`.

### W1 — Customer ordering (`/r/<slug>` → menu → cart → round → status)
1. Sign in, pick the branch, open the menu. **Expect**: the main landmark is reached by
   the skip link; the heading structure reads (restaurant → menu sections → items).
2. Add an item. **Expect**: the item's announcement region confirms the addition
   (polite, once); the cart badge/button state is announced with the count.
3. Open the cart and submit the round. **Expect**: the server refusal (if any) reads
   once via its alert; success reads once from the submit-success region ("Your order is
   in — the kitchen has ticket N") and focus does NOT move.
4. Poll the status timeline until ready/picked-up. **Expect**: the readiness
   announcement reads once ('Your pickup order is ready.' for takeaway per D4/031).

### W2 — Cashier transitions (`/dashboard/rounds`)
1. Tab through the rounds board. **Expect**: logical tab order (groups → cards →
   actions); every action has an accessible name; nothing is hover-only.
2. Open a card's action menu/dialog. **Expect**: focus moves into the surface on open,
   is contained while open, Escape closes, and focus restores to the trigger.
3. Walk assign → mark paid → close keyboard-only. **Expect**: each transition's outcome
   announces politely; no duplicate announcements on the realtime refetch.
4. Void a line. **Expect**: the refusal copy renders verbatim and is announced once.

### W3 — Kitchen ticket (`/dashboard/kitchen`)
1. Park on the landscape board while rounds submit. **Expect**: each arrival announces
   once via the polite sr-only counter region (no per-second spam); the late treatment
   is text-bearing ('late'), not sound or flash.
2. Advance a ticket `new` → `accepted` → `ready` keyboard-only. **Expect**: the walk
   completes with visible focus; columns/counters update politely.
3. Listen through a full refetch cycle. **Expect**: nothing re-announces unchanged
   tickets; no focus steals.

### W4 — Session close (`/dashboard/sessions`)
1. Open the sessions panel with an open table session. **Expect**: the panel reads
   with its labelled regions; the row states are announced with their semantics.
2. Close the session. **Expect**: the inline closure notice (the surface's ONLY
   role=status) reads once; refusal copy if any reads verbatim once.
3. Navigate away and back. **Expect**: no stale announcement replays.

### W5 — Super-admin onboarding (`/admin/platform`)
1. Tab to the onboarding panel. **Expect**: the form reads with labels; the copy-to-
   clipboard affordance has an accessible name and its 'Copied.' status announces.
2. Submit onboarding. **Expect**: the success toast announces (distinct wording from
   the inline status per spec 034 D2); refusal copy reads verbatim once.
3. Adjust subscription dates with end < start. **Expect**: the inline error announces
   (aria-describedby association reads with the field) and submit stays guarded.

## Known environmental notes
- `order.rpc audit-count` flake (shared-cloud live writers) → rerun the spec in
  isolation if it trips.
- Playwright reuses a live dev server on 5173 (`reuseExistingServer: true`).
