# Contracts: Management Client and Dashboard Surfaces (Phase 3)

**Feature**: 004-restaurant-and-branch-management | **Date**: 2026-09-16

The application-side interface of this phase: the management feature module
(`src/features/management/`), the route surface it serves, the guard and
predicate rules, and the user-facing flows the spec requires (FR-002…FR-017).
It extends feature 003's
[auth client contract](../../003-auth-and-rbac/contracts/auth-client.md)
without modifying it except for the single documented route revision (§2).
Route guards and in-page gates are **presentation only**; the enforced
boundary is the management RPC surface
([database-functions.md](./database-functions.md)) — Constitution IV.
The QR artifact's own contract is
[qr-entry-point.md](./qr-entry-point.md).

---

## 1. Module: `src/features/management/`

| File | Responsibility |
|------|----------------|
| `managementClient.ts` | Typed wrappers over the twelve management RPCs. Returns `{ ok: true, data }` / `{ ok: false, message }` — the wrapper NEVER lets a raw database error reach the UI. Error mapping: SQLSTATE `42501` ⇒ the module's generic denial message; `P0001` ⇒ the server message verbatim (the contract writes them for humans, including every caught constraint violation — the named constraint SQLSTATEs never reach the client); anything else ⇒ a generic retry message (a true last resort). No authorization logic, no retries, no optimistic writes. |
| `workingHours.ts` | Pure helpers shared by the editor and the branch view: weekday order/labels from the `weekday` enum, `HH:MM` normalization (the database returns `time` as `HH:MM:SS`), `closesNextDay(open, close)` (`close < open`), and the `{weekday, open_time, close_time}[]` ⇄ editor-state conversions. **No validation rules** — zero-length/overlap rejection is the server's (`replace_branch_working_hours`); the editor surfaces the returned message. |
| `qrEntry.ts` | The QR artifact module — `buildRestaurantEntryUrl(origin, slug)`, SVG generation, PNG data-URL generation ([qr-entry-point.md](./qr-entry-point.md)). |
| `components/RestaurantQrPanel.tsx` | The QR display + download panel (renders the encoded URL as text and the two download affordances). |
| `components/WorkingHoursEditor.tsx` | The weekly schedule editor (per-weekday interval rows; save submits the whole schedule; displays the server's rejection message and leaves the editor state intact). |
| `components/StaffManagementPanel.tsx` | The owner-only staff management controls rendered by the staff page: add member (email, display name, role, branch), change role/branch, remove membership, and the one-time temporary-credential display. |

Query-key conventions: `['management', '<entity>', <scope>]` (e.g.
`['management', 'working-hours', branchId]`); every successful mutation
invalidates the affected keys, and staff mutations additionally invalidate the
auth-context query (`AUTH_CONTEXT_QUERY_KEY`) because effective scope changed.

## 2. Route surface (inside the existing AppShell)

| Route | Guard | Content | Change |
|-------|-------|---------|--------|
| `/dashboard` | **`RequireProfile`** (revised from `RequireStaff`) | With memberships: the existing unified staff area. With a linked profile and no memberships: the **create-restaurant panel** (name, public identifier, optional brand/contact, timezone pre-filled from the browser). Without a profile: `NotAuthorized`. | **REVISED** |
| `/dashboard/profile` | `RequireStaff` | unchanged | — |
| `/dashboard/staff` | `RequireStaff` | The existing policy-scoped staff list (owners + branch managers read it — FR-025) **plus** the owner-only `StaffManagementPanel` and the add-member result panel. Branch managers see no management controls (FR-006, presentation). | **EXTENDED** |
| `/dashboard/restaurant` | `RequireStaff` + in-page owner gate | The selected restaurant's profile form (display name, brand description, contact information, public identifier with the FR-004 warning flow) and settings form (timezone), plus the QR panel. Non-owners: `NotAuthorized`. | **NEW** |
| `/dashboard/branches` | `RequireStaff` | The policy-scoped branch list of the selected restaurant (branch-scoped members see their assigned branch). Owner-only: create branch, rename. | **NEW** |
| `/dashboard/branches/:branchId` | `RequireStaff` + policy-scoped read | The branch view: name, **working hours** (schedule display; owner-only editor), and **tables** (list with state; owner-only create/rename/activate/deactivate). A branch id outside the caller's scope renders the empty denial state — the table reads return nothing under the policies, and no branch identity is echoed. | **NEW** |

**Route revision note (003 → 004)**: feature 003's contract lists `/dashboard`
as `RequireStaff`. FR-001's bootstrap requires a linked profile *without*
memberships to reach restaurant creation, and a `RequireStaff` guard excludes
exactly that identity by definition. `RequireProfile` (linked profile) is the
narrowest guard that admits it; the unlinked-identity denial (003 FR-005) and
the "rejected, not hidden" behavior (003 FR-014) are unchanged. Every other
003 route row is untouched.

## 3. Guards and predicates (`src/features/auth/guards.tsx`, `useAuthContext.ts`)

| Addition | Behavior |
|----------|----------|
| `RequireProfile` | Wraps `RequireAuth`; while the context resolves renders nothing; on a failed context query or with `profile === null` renders `NotAuthorized` (deny-by-default presentation, same posture as the existing gates). |
| `canManageRestaurant(restaurantId)` *(predicate on `useAuthContext`)* | True for an `owner` membership of that restaurant. Presentation gate for management controls and pages; grants nothing. |

`canReadStaffList` (003) is unchanged. Guards may gain predicates; they never
gain authorization power.

## 4. Required user-facing flows (spec-mandated behaviors)

1. **Public-identifier change (FR-004)** — on the restaurant page, when the
   submitted identifier differs from the stored one, the UI must first show
   the consequence warning (the old identifier no longer addresses this
   restaurant and is not retained — no alias, no redirect) and continue only
   after explicit confirmation; cancelling leaves the identifier unchanged.
   After a confirmed change: a success
   indication, the new public entry URL, and the QR panel re-derived from the
   new identifier (re-download available).
2. **Working-hours rejection (FR-008, US2 scenario 4)** — a save the server
   rejects (zero-length or same-day overlap) surfaces the returned clear
   message and leaves the editor's previously stored schedule unchanged
   (the page re-reads).
3. **Temporary credential (FR-013)** — the panel states the outcome from the
   return shape, never from "the person already existed" alone:
   `temporary_password === null` ⇒ "existing person linked, no credential was
   issued"; a non-null `temporary_password` with `person_created === false` ⇒
   "existing person's account was completed and a new temporary credential
   was issued" (the unclaimed-stub case of research.md §5, reachable after
   `db:reset`). Whenever `temporary_password` is non-null, the panel displays
   it once with a copy affordance and a plain-language note (share it with
   the person; it is not shown again and can be rotated via the platform's
   password-recovery flow).
4. **Table lifecycle (FR-011)** — inactive tables remain visible with their
   state; activation and deactivation are explicit actions; renaming works
   while inactive.
5. **Scoped surfaces (FR-017)** — every page renders only what the caller's
   roles and scope allow: owners see all their restaurants and branches and
   the management affordances; branch-scoped members see their assigned
   branch's view without management affordances; cashiers/kitchen see no
   management surfaces; the platform super admin sees no management surfaces
   (FR-021).
6. **Creation bootstrap (FR-001)** — a linked profile with no memberships sees
   the create panel at `/dashboard`; on success the dashboard's context
   refreshes and the new restaurant appears as the selected context.

## 5. Client-side failure handling

- Denials (`42501`) render as an explicit "not permitted" notice — never a
  silent no-op, never a success state.
- Validation messages (`P0001`) are shown next to the form, verbatim; input
  values are preserved so the owner can correct them.
- Reads that return nothing under the policies (out-of-scope deep links)
  render the denial/empty state without echoing the requested identity
  (feature 003's honesty rule: names only for rows the caller may read).

## 6. Stability commitments

1. **No authorization logic in the application module or pages.** Any change
   that would let a guard/gate substitute for an RPC check is a Constitution
   IV violation and fails review.
2. **One client module for the management RPCs** — pages import
   `managementClient`, never `supabase.rpc` directly, so the error-mapping and
   no-raw-error properties are auditable in one place.
3. **The route revision in §2 is the only change this phase makes to feature
   003's route contract.** Future additions to the surface are additive rows.
4. `managementClient` never gains generic CRUD helpers for configuration
   tables: writes exist only as the named operations of
   [database-functions.md](./database-functions.md).
