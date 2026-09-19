# Quickstart: Menu Management (Phase 4)

**Feature**: 005-menu-management | **Date**: 2026-09-17

How to validate this feature end to end. Prerequisites and the canonical
workflow live in [development.md](../../docs/development.md); this guide maps
the feature's requirements to runnable checks. Artifacts behind the checks:
[plan.md](./plan.md), [data-model.md](./data-model.md),
[contracts/](./contracts/), [research.md](./research.md). Implementation
details belong to `tasks.md`.

---

## 1. Prerequisites

| Step | Command | Precondition |
|------|---------|--------------|
| Database | `npm run db:migrate && npm run db:seed` | reachable cloud development project (`.env` configured) |
| Storage | — (automatic) | the `menu-images` bucket is created by the `<ts>_menu_media` migration; no dashboard step |
| Types | `npm run types:gen` | the regenerated `src/types/database.types.ts` is committed with the migrations |
| App | `npm run dev` → <http://localhost:5173> | for the manual walkthroughs |

The seed provides everything the walkthroughs need: Blue Olive (Downtown,
Marina) with its **shared demo menu** — four categories, 10–12 items
with descriptions and two-decimal prices, extras on two items, one item stopped
restaurant-wide (with a Marina override row proving the hard stop wins), one
item overridden unavailable at Marina only — plus Cedar Grill's own menu (its
branch is Airport) for isolation checks, and the seeded identities: **alice** (owner, Blue Olive),
**bob** (branch manager, Downtown), **carla** (cashier, Downtown), **dan**
(kitchen, Marina), **eve** (owner, Cedar Grill), **platform-admin** (super
admin), **fiona** (linked profile, no memberships). Passwords follow the
`dev-<name>-2026` pattern (`tests/database/helpers/fixtures.ts`). No manual data
setup is required (SC-007); images are the one exception by design — the seed
cannot upload objects (FR-028 as reconciled, research.md §16).

---

## 2. Automated validation

| Command | Proves |
|---------|--------|
| `npm run test:db` | The data-layer matrix: the fourteen RPCs' authorization (owner / branch manager / cashier / kitchen / other restaurant / super admin / unlinked — FR-002/FR-003), every validation bound and message (FR-005, FR-008, FR-010, FR-019, FR-021), the **hard stop** beating an existing override and override set/clear/no-op semantics (FR-012/FR-013), cross-branch non-interference, reorder coverage and determinism (FR-009), category deletion only when empty (FR-006), no-op writes producing no audit rows (FR-016), one audit record per accepted change with action, scope, and change string (FR-024), and the `get_branch_menu` payload shape, ordering, and `unavailable_reason` values (FR-014/FR-015). Rolled-back transactions — no residue. |
| `npm run test:integration` | The real-API round trip against Storage with a real owner session: upload to the owner's prefix (FR-021), authenticated read of a referenced object, bucket-limit rejections (oversized, wrong MIME), another restaurant's member denied insert/read/delete (FR-023), a branch manager denied upload, and a replaced object unreadable after the reference moves (FR-022). Scratch objects are removed in teardown. |
| `npm run test:unit` | Money rules (validation, canonicalisation, formatting; no float arithmetic — FR-010), branch-menu payload parsing (malformed payloads rejected), RPC error mapping, image path building. |
| `npm run test:e2e` | The browser presentation matrix: the owner's menu surfaces over the seeded fixture, the branch customer view excluding the stopped item and showing the override-hidden one as missing (exit condition, FR-014/FR-015), a branch manager's own-branch availability surface, and the cashier/kitchen/other-tenant/super-admin denials on menu deep links. Read-and-reject only — no tenant writes (research.md §14). |
| `npm run verify` | The full gate (format, lint, typecheck, unit, database, integration, build) — must pass with the extended suites. |

Rate-limit notes (feature 003 precedent): the integration and e2e suites add
sign-ins; keep runs under the Auth API's 30-per-5-minutes limit per IP
(docs/development.md).

---

## 3. Walkthrough A — the owner builds the menu (SC-001, exit condition)

Sign in as **alice** and open `/dashboard/menu`.

1. **The shared menu renders** in its stored order: Starters, Mains, Desserts,
   Drinks, each item with its description and a two-decimal price (FR-001,
   FR-009).
2. **Create a category** "Specials"; it appends at the end. Create an item in
   it — name, description, price `12.50` — and confirm it appears last within
   the category (FR-005, FR-007).
3. **Reprice it** to `13.75`; the new price shows everywhere the item appears
   (including the branch view of step 7). FR-016's record is checked in
   Walkthrough C.
4. **Invalid input is rejected with its message and changes nothing**: a blank
   category name, a category name that already exists ("Drinks"), an item price
   of `-1`, and a price of `12.345` (three decimals — rejected, never rounded);
   the stored values are unchanged (FR-005, FR-008, FR-010).
5. **Deleting "Mains" is rejected** ("still contains items"); move its items to
   "Specials" first — the items keep their history and identity — then the
   empty "Mains" can be deleted; "Desserts" is untouched (FR-006, FR-007).
6. **Extras**: add a free extra and a paid extra to an item; both appear only
   on that item's editor and in the branch view's item (FR-018). Retire one;
   the other remains; the bound message appears when the 21st extra is
   attempted on one item (FR-019).
7. **Reorder**: drag/reorder categories and the items inside one; reload — the
   order persisted exactly (FR-009).
8. **Image**: upload a JPEG/PNG/WebP under 5 MiB for an item; it renders in the
   editor and the branch view. Upload a 6 MiB file and a PDF — both rejected
   with the failing bound named; the item keeps its image (FR-021). Replace the
   image; the new one renders. Remove it; the item presents without an image
   (FR-022).
9. **Branch view**: open the Downtown branch's menu view
   (`/dashboard/branches/<Downtown id>/menu`) → the customer view shows the
   built menu in the same order, prices included — the exit condition's "owner
   can maintain the menu" half, verifiable in one screen (FR-014).

Seed convergence: re-running `npm run db:seed` restores the seeded menu rows
(they are written with `on conflict … do update` on the values the seed owns);
rows created during the walkthrough stay until deleted through the UI.

## 4. Walkthrough B — availability, overrides, and the hard stop (exit condition)

1. As **alice**, open the branch view for **Downtown** and for **Marina**
   (two tabs). The fixture's stopped item is missing from both customer views;
   the override-hidden item is missing at Marina only and present at Downtown
   (FR-012, FR-013 — the hard stop and the everyday override).
2. Stop another item restaurant-wide; both branches' customer views lose it,
   and both show it in the staff view with `unavailable_reason: "restaurant"`.
   Set an override at Marina for it (allowed — it is legal, just ineffective);
   the reason stays `"restaurant"` and the item stays unoffered there: **the
   branch cannot reverse a restaurant-wide stop** (clarified rule; FR-012,
   FR-013).
3. Make it available again; Marina now shows `unavailable_reason: "branch"`
   (its override is still recorded and applies) while Downtown offers it again
   (FR-013; spec Edge Cases).
4. Clear Marina's override; Marina offers it too — the branch returned to the
   restaurant-wide state (FR-013).
5. As **bob** (branch manager, Downtown): he can toggle Downtown's availability
   and sees the resulting state; `/dashboard/menu` renders `NotAuthorized`, and
   Marina's branch menu route is denied (FR-003; Constitution IV — denied at
   the trusted layer, not merely hidden).
6. As **alice**, override an item at **Marina**; verify **Downtown** is
   unaffected (cross-branch isolation, FR-013). (Airport is Cedar Grill's
   branch in the seed, so a Blue Olive owner's override there is denied — the
   denial itself is checked in step 5's matrix.)
7. **Exit condition check**: every saved availability change is visible in the
   affected branch's customer view on the next load — no refresh trick, no
   stale value (FR-015; SC-004).

## 5. Walkthrough C — scope, denials, recorded change, and images

1. **Isolation**: as **eve** (owner, Cedar Grill — and a Downtown cashier at
   Blue Olive, the seed's dual-role fixture), `/dashboard/menu` shows Cedar
   Grill's menu only; Blue Olive's categories, items, extras, and overrides
   are unreachable (FR-004, FR-026). Her single staff-scoped read of the
   Downtown branch menu succeeds by the same grant carla has — write access
   to Blue Olive is denied on every path.
2. **Read scope**: as **carla** (cashier, Downtown), the Downtown branch menu
   renders (FR-014) with no availability controls; as **dan** (kitchen,
   Marina), Marina's renders and every availability attempt is denied
   (FR-003; master plan §19).
3. **Super admin**: **platform-admin** reaches no menu surface at all
   (feature 003 FR-012 continuity).
4. **Recorded price change**: after Walkthrough A step 3, the audit store holds
   `menu.item_price_changed` for that item with the actor, the timestamp, the
   tenant scope, and `price: 12.50 -> 13.75` (FR-016). Reading it requires the
   database (no client-readable audit path exists — feature 002 FR-013);
   `npm run test:db` asserts exactly this. Saving the same price again produces
   **no** new record (FR-016). What an already-submitted order does with the
   old price becomes checkable in feature `008` — this phase guarantees the
   record and never presents the current price as a historical one
   (FR-017).
5. **Image privacy**: with a second restaurant's session, requesting Blue
   Olive's image path through the Storage API is denied, and no listing shows
   another restaurant's objects (FR-023). In the owner's session, the image for
   an item whose reference was replaced is no longer retrievable (FR-022).

---

## 6. Cleanup and notes

- Walkthrough data is additive edits to seeded restaurants (categories, items,
  extras, overrides, images). `npm run db:seed` converges the seeded rows;
  walkthrough-only rows can be removed through the UI (items themselves are
  never deleted — that is the spec, not a gap).
- Uploaded objects live in the private `menu-images` bucket; removing an item's
  image through the UI deletes the object. Objects orphaned by a failed cleanup
  are invisible to every client (research.md §11).
- The e2e suite must remain write-free; a menu change made in a browser by hand
  is walkthrough data, not test data.

## 7. Validation record — 2026-09-19 (T047)

The walkthroughs were executed programmatically against the live development
project (real sign-ins through the Auth API, every change through the real RPCs
on the Data API, the real Storage bucket, and one postgres-level read for the
audit store — the only client-unreadable surface), mirroring feature 003/004's
method. **56 checks, all passing** — every step of Walkthroughs A, B, and C in
order, on a freshly reset+seeded database, with all walkthrough data cleaned up
by the run itself. Two walkthrough steps were corrected where the seed's
fixture topology required it (see §5/§6 notes and the corrections recorded
below); the corrections strengthen, not weaken, the checks.

| Check | Result | Date | Notes |
|-------|--------|------|-------|
| `npm run verify` | ✓ PASS | 2026-09-19 | format, lint, typecheck, unit 154/154, database 209/209, integration 4/4, production build |
| `npm run test:e2e` | ✓ PASS | 2026-09-19 | 40/40 — includes the US4 extras presentation check (T036) |
| Walkthrough A | ✓ PASS | 2026-09-19 | 29/29 checks: build (category → item → reprice), invalid-input rejections with stored values unchanged, non-empty-category refusal + item moves preserving identity, extras (free+paid, item-scoped, retire, the 20-extras bound), reorder persistence, the full image lifecycle (upload → reference → signed render → 6 MiB/PDF refusals → replace returns previous path → replaced object unretrievable → remove), branch-view exit condition |
| Walkthrough B | ✓ PASS | 2026-09-19 | 16/16 checks: seeded stop/override matrix, restaurant-wide stop at both branches with reason `"restaurant"`, the legal-but-ineffective override on a stopped item, restore showing reason `"branch"` at Marina, override clear, bob's own-branch toggle + structure denial + foreign-branch denial, Marina override leaving Downtown unaffected (isolation) |
| Walkthrough C | ✓ PASS | 2026-09-19 | 11/11 checks: eve's write isolation + own-restaurant read scope, cashier/kitchen read + write denials, super-admin full denial, `menu.item_price_changed` audit with exact `price: 12.50 -> 13.75` reason, no record for a re-saved price, eve's insert/list denials on Blue Olive's Storage prefix and no leftover objects |

Corrections discovered by the run (both doc errors, now fixed above):

1. Walkthrough B step 6 named **Airport** as alice's cross-branch-isolation
   target, but the seed gives Airport to Cedar Grill — a Blue Olive owner's
   override there is denied (that denial is step 5's matrix working as
   designed). The step now targets Marina with Downtown as the unaffected
   branch.
2. Walkthrough C step 1 implied eve has no read path into Blue Olive; the seed
   makes her a **Downtown cashier** there (the dual-role fixture), so her
   single staff-scoped read succeeds by design while every write path is
   denied. The record above asserts exactly that matrix.
