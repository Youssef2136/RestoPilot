# Quickstart: Restaurant and Branch Management (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

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
| Types | `npm run types:gen` | the regenerated `src/types/database.types.ts` is committed with the migrations |
| App | `npm run dev` → <http://localhost:5173> | for the manual walkthroughs |

The seed provides everything the walkthroughs need: Blue Olive (Downtown,
Marina) with profile/settings and working hours, Cedar Grill (Airport),
seeded staff identities including **Fiona** (`fiona@restopilot.dev`, no
memberships — the creation bootstrap), an inactive table, and the QR's public
identifier. No manual data setup is required (SC-007).

---

## 2. Automated validation

| Command | Proves |
|---------|--------|
| `npm run test:db` | The data-layer matrix: the management RPCs' authorization (non-owners, other restaurants, other branches, anon, super admin — FR-005/FR-006/FR-021), the validation rules (slug, names, working hours incl. cross-midnight and boundary-touching, per-branch labels, last-owner safeguard, duplicates — FR-001/FR-004/FR-008/FR-010/FR-011/FR-013/FR-016), the working-hours table's declarative guarantees (FR-008), the audit records with actor/action/resource/scope (FR-020), and the new read surfaces' scope rules (FR-025). Everything runs in rolled-back transactions — no residue. |
| `npm run test:integration` | The exit-condition path over the real APIs: an owner provisions a staff member through `add_staff_member`, the returned temporary credential signs in through the real Auth API, `current_auth_context` resolves exactly the assigned scope, and out-of-scope data reads are denied through the real client (FR-013/FR-014/FR-017; SC-004). Scratch rows are removed in teardown. |
| `npm run test:unit` | The QR entry-URL derivation and artifact generation (FR-018), the management client's error mapping (denials vs clear messages), and the guard/predicate matrix for the new surfaces (`RequireProfile`, owner-only management). |
| `npm run test:e2e` | The browser presentation matrix: owner-visible management surfaces and QR payload text, the FR-004 warning before confirming an identifier change, a working-hours rejection message, branch managers' own-branch view, and non-owner/super-admin denials on management deep links. Read-and-reject only — the e2e suite creates no tenant data (research.md §16). |
| `npm run verify` | The full gate (format, lint, typecheck, unit, database, integration, build) — must pass with the extended suites. |

Rate-limit notes (feature 003 precedent): the integration and e2e suites add
one sign-in each (Fiona); no test sends any email — this phase sends none at
all. Leave ≥ 60 s between consecutive `test:integration` runs.

---

## 3. Walkthrough A — the owner's full setup journey (SC-001, exit condition)

Sign in as **Fiona** (`fiona@restopilot.dev` — a linked profile with no
memberships).

1. **Create the restaurant** — the dashboard offers the creation panel
   (FR-001). Submit a display name and public identifier; optionally set the
   pre-filled timezone. Expected: the restaurant appears in the dashboard as
   the selected context with Fiona as owner, and the branch/restaurant
   management surfaces become reachable.
2. **Invalid creation** — retry with a blank name, a malformed identifier
   (`Blue Olive!`), and an identifier already in use (`blue-olive`).
   Expected: each attempt is rejected with a clear message and no partial
   record appears anywhere.
3. **Profile and settings** — on `/dashboard/restaurant`, edit the display
   name, brand description, and contact information, and set the timezone.
   Expected: the values persist and are shown consistently on the page and in
   the dashboard.
4. **Create a branch** (`Downtown`) and rename it and back; create a second
   branch. Expected: both belong to this restaurant; duplicate display names
   remain allowed.
5. **Working hours** — set Downtown to Mon–Fri 11:00–15:00 plus 18:00–02:00
   (the post-midnight dinner service), Saturday 12:00–02:00, Sunday empty
   (closed). Expected: the schedule is stored and displayed as such, the
   18:00–02:00 interval reads as ending the following day, and Sunday reads
   as closed.
6. **Working-hours rejections** — try 10:00–10:00 (zero-length) and
   10:00–14:00 plus 13:00–18:00 (overlap) on one day, and 10:00–14:00 plus
   14:00–18:00 (boundary — must be accepted). Expected: the first two are
   rejected with a clear message and the stored schedule is unchanged; the
   boundary case saves.
7. **Tables** — create T1–T3 in Downtown; renumber one (T3 → T4); deactivate
   T4. Expected: labels are unique per branch (creating another `T1` in
   Downtown is rejected; `T1` in the second branch is accepted); the inactive
   table stays visible with its state and can still be renamed; deactivating
   again changes nothing.
8. **Staff** — add a branch manager (Downtown), a cashier, a kitchen member,
   and one more owner, each by email and display name. Expected: each person
   gains a membership; for new emails a temporary credential is shown exactly
   once; a branch-scoped role without a branch (and an owner with one) is
   rejected; adding the same person twice with the same role and branch is
   rejected; adding an email that already exists on the platform links the
   existing person (no duplicate).
9. **The added person's sign-in** — sign out, sign in with the shown
   temporary credential. Expected: the staff area opens with exactly the
   assigned scope (the branch-scoped roles reach their branch only; another
   branch of the same restaurant is not reachable). Repeat for the other
   roles by changing their role/branch as the owner and re-checking on their
   next access; then remove one membership and confirm that access ends while
   the person still exists.
10. **The last-owner safeguard** — as the only remaining owner of a
    restaurant, attempt to remove or demote yourself. Expected: rejected with
    a clear message; the restaurant still has an owner.
11. **Obtain the QR** — on `/dashboard/restaurant`, view the QR (the encoded
    URL is shown as text) and download SVG and PNG. Expected: both artifacts
    encode the restaurant's current public entry URL, carry no branch or
    table information, and are stable across downloads while the identifier
    is unchanged. Decode one with a phone camera or scanner and confirm it
    resolves to the public entry page.
12. **Identifier change (FR-004)** — change the public identifier. Expected:
    the owner is warned that the old identifier no longer addresses this
    restaurant and is not retained or encoded anywhere (no alias, no redirect)
    and must confirm before the change is submitted; cancelling leaves the
    identifier unchanged; after confirming, the entry URL and a freshly
    downloaded QR encode the new identifier. (How an old printed code or
    shared link then resolves is the public route's semantics — feature 001's
    placeholder and feature 007 — not a guarantee of this phase.)

Success = a single session completes steps 1–12 against one restaurant in
well under 15 minutes (SC-001).

## 4. Walkthrough B — scope and denial checks (FR-005/FR-006/FR-017/FR-021/FR-025)

| Actor | Check | Expected |
|-------|-------|----------|
| Bob (branch manager, Downtown) | Use the staff area; open the branch view; attempt a management action through the UI and, in the browser devtools, call `add_staff_member` / `create_branch` / `update_restaurant_profile` directly with the session's token | Sees Downtown's configuration (working hours, tables); no management controls anywhere; every direct call is denied (`42501`) with no state change |
| Carla (cashier) / Dan (kitchen, Marina) | Deep-link `/dashboard/staff` and `/dashboard/restaurant`; attempt the management RPCs directly | `NotAuthorized` views (rejected, not hidden); RPC calls denied; Marina is invisible to Carla and Downtown to Dan |
| Eve (owner of Cedar Grill, cashier of Downtown) | Open the management surfaces | Cedar Grill management works; Blue Olive management is absent/denied; nothing outside either scope |
| Platform Admin (super admin, no memberships) | `/dashboard`, `/admin`, direct management RPCs against any restaurant | The capability grants no tenant access: no restaurant data, no management success on any existing restaurant (FR-021) |
| Fiona (no memberships) | Before Walkthrough A: `/dashboard` | The creation panel only — no other tenant's data anywhere |
| Any staff member of another restaurant | Craft a direct data request for this restaurant's profile, hours, or tables | Denied — feature 002/003 tenant isolation is unchanged over the new surfaces (FR-022/FR-025) |

## 5. Walkthrough C — working state, audit, and privacy (FR-009/FR-019/FR-020)

1. **Working state is authoritative** — read `branch_working_hours` back
   through the app after each save; the branch view and the editor agree with
   the stored rows.
2. **Audit records exist and stay unreadable** — as the database owner
   (a `psql` session on `SUPABASE_DB_URL` or the database test helpers),
   confirm one record per accepted change from Walkthrough A with actor,
   action, resource, and tenant/branch scope. As any staff identity, attempt
   `select * from public.audit_log` — denied (`42501`), unchanged from feature
   002. No audit viewing UI exists.
3. **Nothing new is public** — signed out, request the restaurant's public
   entry URL (works, feature 001 placeholder) and attempt to read any
   configuration table or call any management RPC with the anon key — denied.

## 6. Cleanup and notes

- The database and integration suites leave no residue. Walkthrough A creates
  real data in the development project; `npm run db:reset` (destructive,
  development project only) returns to the seeded fixture, and
  `npm run db:reset -- --yes --purge-auth` additionally restores the seeded
  identities' documented passwords.
- A person provisioned through the app during a walkthrough is an `auth.users`
  row like the seeded identities; it survives `db:reset` (the auth schema is
  untouched) and, having no profile after the reset, can be re-added through
  the app (the credential is then re-issued — research.md §5).
- `platform-admin` and Fiona are the two membership-less seeded profiles and
  serve different checks: the former proves the capability grants nothing,
  the latter proves the creation bootstrap.

---

## 7. Validation record — 2026-09-16/17

The walkthroughs were executed against the real Auth and data APIs (the exact
calls the UI makes) on a migrated, seeded development project, with the
results below. **27 checks, all passing.**

**Walkthrough A — the owner's full journey as Fiona (SC-001, the exit
condition)**: passed end to end. The restaurant was created (Fiona became its
owner and the restaurant appeared as the selected context); invalid creations
(blank name, malformed identifier, identifier already in use) were each
rejected with a clear message and left no record; profile and settings
persisted; branches were created, renamed, and allowed a duplicate display
name; the weekly schedule stored with the 18:00–02:00 interval reading as
ending the following day and Sunday closed; the zero-length and overlapping
replacements were rejected with the stored schedule unchanged while the
boundary-touching pair saved; tables were created, renumbered, and
deactivated, with per-branch label uniqueness enforced, the same label
accepted in another branch, inactive tables still renameable, and repeated
transitions no-ops; staff were added for every role (credentials issued once
for new emails, an existing person linked with no duplicate and no credential,
invalid role/branch combinations and duplicates rejected); the issued
credential opened the staff area with exactly the assigned branch scope and no
reach into the other branch; a removed membership ended access while the
person persisted; removing one of two owners was allowed while the last owner
could neither be demoted nor removed; and the identifier change persisted with
the old identifier retained nowhere and the entry URL re-derived.

**SC-001 timing**: the whole journey (steps 1–12, the equivalent of every
action the UI performs) completed in **9.8 s** of working time — the spec's
success criterion is a single session well under 15 minutes.

**Walkthrough B — scope and denial matrix (FR-005/FR-006/FR-017/FR-021/FR-025)**:
passed for every actor. Bob (branch manager), Carla (cashier), Dan (kitchen),
Eve (owner of the other restaurant), and the Platform Admin were each denied
`42501` on `add_staff_member`, `create_branch`, and
`update_restaurant_profile` with no state change; Eve and the Platform Admin
could not read this restaurant at all, the Platform Admin reads no tenant data
anywhere, Fiona read only the restaurant she owns, and a staff member of
another restaurant read nothing of this tenant.

**Walkthrough C — working state, audit, and privacy (FR-009/FR-019/FR-020)**:
passed. The stored `branch_working_hours` rows were the authoritative schedule
(11 rows including the post-midnight interval); the audit log carried the
expected vocabulary (`restaurant.created`, `branch.created`, `table.created`,
`staff.added`, …) with actor, action, resource, and tenant/branch scope; a
staff client could not read `audit_log`; and the `anon` role could neither
call a management RPC nor read configuration.

**Restored state**: the walkthrough created real data, as §6 describes. It was
removed with `npm run db:reset -- --yes`, followed by purging the
`walkthrough-%` auth identities (they survive the reset by design); the
project returned to the seeded fixture exactly — 2 restaurants, 3 branches,
5 dining tables, 24 working-hour intervals, 6 staff memberships, 7 profiles,
7 seeded identities.

**Remaining manual step (not automatable here)**: decoding a downloaded QR
artifact with a phone camera or scanner — step 11's confirm-that-it-resolves
check, including the post-identifier-change round. Everything the artifact
encodes is asserted mechanically (the payload builder is pinned by the unit
suite, the derivation and the no-branch/no-table grammar by `test:unit`, and
the panel's payload text plus its owner-only visibility by `test:e2e`); what
remains is the physical scan, which needs a camera.
