# Phase 07 Findings

## F1 — REAL backend bug: restore (DELETE) events never reached realtime subscribers (fixed)
The exit-criterion journey (Bob toggles → the observer's customer view updates without refresh)
kept failing on the RESTORE leg only. Root cause chain: `branch_unavailable_items` has a
surrogate `id` primary key → default REPLICA IDENTITY → WAL DELETE payloads carry only `id` →
Realtime evaluates the `branch_id=eq.<uuid>` channel filter AND the staff SELECT policy against
that payload → `branch_id` is absent → the row matches neither → the event is silently dropped.
STOP events (INSERT) carried the full row and always worked, which made the asymmetry hard to
see. Fix: migration `20260930090000_menu_override_replica_identity.sql` (REPLICA IDENTITY FULL;
the table is presence-only and immutable, so the wider payload has no semantic cost). Verified
by the 6/6 realtime E2E and the full 167-test run.

## F2 — Test-suite race found and closed: Fiona's identity was only sign-in-locked
`fionaLock` held the shared Fiona fixture across SIGN-INS, but `management.surfaces`' FR-001
assertions (creation panel = no memberships) ran unlocked while `full-journey`'s creation flow
could concurrently make her a real owner — the failure screenshot showed Fiona owning 'Dress
Rehearsal'. Both Fiona tests (`management.surfaces` FR-001, `shell` sign-out) now hold the lock
across the whole body via `acquireFionaLock`/`withFionaLock` (non-reentrant — they sign in with
plain `signInAs` inside the held lock, the established auth.routes pattern).

## F3 — Convergence regression caught by the full suite: section-nav label collision
The T002 re-skin named the Menu page's section-nav button 'Add category', colliding under
Playwright strict mode with full-journey's pinned 'Add category' (the create form's submit).
Renamed to 'Add a category' (matching the pinned h3) — full-journey passed unedited afterwards.

## F4 — Accessibility floor fixed at the root: empty-category button contrast
The E2E scratch category (empty) surfaced a REAL axe violation on the customer menu: the empty
category-nav button's `opacity: 0.5` over `--color-ink` composited below the 4.5:1 floor.
Fixed with `--color-ink-muted` (the token holds ≥4.5:1) instead of an opacity — no
allowlisting, the axe floor itself holds on data-dependent states. First caught in the full
suite ONLY because earlier suites' scratch residue made a category empty; isolated runs never
saw it.

## F5 — Design-literal gate catches comments too
The contrast fix's first comment named the composited hex value; `design.literals.test.ts`
failed. Comments in module CSS must describe intent, not carry raw color values.

## F6 — Serial customer-journey residue: open T2 sessions accumulate
`customer.menu`'s serial tests share a customer session; crashed mid-file runs leave open T2
sessions and later runs read accumulated bill subtotals (4 Subtotal dts). The suite assumes a
fresh seed — the standing reset-before-E2E procedure covers it; no code change.

## F7 — Editor label mechanics (browser-verified, documented for future phases)
The editor's accessible name lives on `section[aria-label="Edit <item>"]` and follows the
item's CURRENT name — after a rename, re-query by the NEW name. No-change saves keep the editor
open with 'No changes to save.'; changed saves keep it open (Close dismisses). The 390px test
scopes to `region 'Edit Hummus'` → `form 'Item details for Hummus'`.
