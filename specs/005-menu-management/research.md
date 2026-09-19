# Research: Menu Management (Phase 4)

**Feature**: 005-menu-management | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

Phase 0 decisions for the menu domain. Each section states the decision, the
rationale, and what was rejected. The spec's Assumptions deferred two things to
this plan — the exact image bounds and the mechanisms behind the price-recording
and role requirements — resolved in §6, §10, and §11. Sources for the Supabase
Storage facts are the official documentation and the `supabase/storage` schema
migrations, cited inline.

---

## 1. Write path: fourteen explicit RPCs, no client write grants

**Decision**: Every menu mutation is a `security definer` function in `public`,
created with `set search_path = ''`, schema-qualified bodies, authorizing its
caller through the existing `private` helper family as its first act, writing
exactly one `private.record_audit` record in the same transaction, and
translating constraint violations caught **by constraint name** into
user-facing `P0001` messages. No insert/update/delete grant is added to any
table. Execute is granted to `authenticated` only.

**Rationale**: This is feature 004's proven pattern (research.md §1 there) and
the project's stated preference for explicit contracts on high-risk operations
(master plan §34). The menu is a multi-row domain where a single operation
touches an item, its extras, its availability rows, or an ordering sequence —
exactly the cases where Supabase's own guidance prefers functions over raw
table writes. It also keeps the authorization matrix testable in one place.

**Rejected**: Direct table writes with RLS insert/update policies (would spread
validation across policies, make reorder sequences non-atomic, and require
write grants the project has deliberately never issued); PostgREST-side checks
(the client is untrusted by construction).

**Operation split** (the clarified role boundary): content, prices, extras,
images, the restaurant-wide availability state, and any branch's overrides are
owner-only, authorized via `private.owned_restaurant_ids`. Branch availability
is additionally granted to the manager **of that branch**, authorized via the
new helper `private.branch_manager_branch_ids` (branches where the caller holds
a `branch_manager` membership). Cashiers and kitchen staff receive no write
path in this phase (master plan §19 places the cashier's availability action in
the cashier feature and forbids kitchen staff from managing availability).

---

## 2. Availability model: a restaurant-wide boolean plus a presence-only override table

**Decision**:

- `menu_items.is_available boolean not null default true` — the restaurant-wide
  state (FR-012).
- `public.branch_unavailable_items (id, restaurant_id, branch_id, item_id,
  created_at)` — **the presence of a row is the override**: the item is
  unavailable at that branch (FR-013).

**Rationale**: The 2026-09-17 clarification made the restaurant-wide state a
hard stop and the override one-directional (`available` restaurant-wide →
`unavailable` at one branch, never the reverse). A presence-only table encodes
exactly that rule with no state column that could contradict it, and it makes
the effective rule a single expression:

```text
effective_availability(branch, item)
  = item.is_available and not exists (override row for branch, item)
```

Any other shape (a three-state enum, a nullable per-branch state, a symmetric
override) can express states this phase's rules forbid — the schema would then
permit contradictory data that only the RPCs prevent. Presence-only keeps the
database itself honest (Constitution VI).

**Clearing an override** is a row delete, so "the branch returns to the
restaurant-wide state" is structural, not a value that could drift. Deleting an
item is impossible in this phase, so the override table's FKs can be plain
`restrict` references with no cascade semantics to reason about.

---

## 3. Effective availability is computed in the database, once

**Decision**: The only place the conjunction in §2 is computed is inside
`public.get_branch_menu(p_branch_id)` (the read projection of §5). The
management surfaces read the raw tables under policies; they display states,
they do not derive the offered value. Feature `008-cart-and-rounds` will
re-derive it server-side at order time (§35's "unavailable item ordering").

**Rationale**: Constitution V forbids client-computed business-critical state,
and §35 makes the effective availability a correctness rule that order
submission must apply. Computing it exactly once, in SQL, means the preview the
exit condition depends on and the eventual order validation share one
definition.

**Rejected**: a client-side conjunction of two policy-scoped reads (two round
trips, two places to get the rule wrong, and a branch manager querying another
branch would silently see "available" because that branch's override rows are
invisible to them under RLS — a wrong answer, not just a denied one);
persisting a derived `is_offered` column (a derived value that can go stale,
contradicting Constitution VI's single-valued requirement and adding write
fan-out to every availability change).

---

## 4. Image storage: one private bucket with declarative limits

**Decision**: A single private bucket `menu-images`, created by migration:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

`storage.buckets` carries `file_size_limit bigint` and `allowed_mime_types
text[]` (schema as documented for the Storage service; the columns were
introduced by `0013-add-bucket-custom-limits.sql` and
`0014-use-bytes-for-max-size.sql` in `supabase/storage`). Rejections are
enforced by the Storage service before any policy runs: oversized uploads
return 413 `EntityTooLarge`, disallowed types 400 `InvalidMimeType`.

**Rationale**: The spec requires documented, enforced format and size bounds
(FR-021, §33). Bucket-level limits are the only place those bounds are enforced
for *every* writer, including the Storage API path that bypasses the database.
Private because nothing in this phase may be publicly readable (FR-004/FR-026) —
public delivery of images to customers is feature `007`'s decision (signed URLs
or a public-read policy), not this phase's.

**Rejected**: a public bucket (would make every image world-readable and
enumerable, contradicting FR-023 and the phase's public-surface boundary);
client-side-only validation (bypassable by any direct Storage call); a
per-image database row tracking sizes (duplicates Storage's own bookkeeping);
Edge-Function-issued signed upload URLs (a new runtime for no gain — the
authenticated path with policies is sufficient and testable).

---

## 5. The branch menu read: one `security invoker` projection

**Decision**: `public.get_branch_menu(p_branch_id uuid) returns jsonb` —
`security invoker`, `stable`, `set search_path = ''`. It authorizes explicitly
first: the caller must be an owner of the branch's restaurant **or** hold any
branch-scoped membership on that branch (`private.staff_branch_ids`); anything
else raises `42501`. It then reads `menu_categories`, `menu_items`,
`menu_item_extras`, and `branch_unavailable_items` **under the caller's own
RLS policies** and returns an ordered payload:

```json
{ "branch": {"id": "...", "name": "..."},
  "restaurant": {"id": "...", "name": "...", "slug": "..."},
  "categories": [
    { "id": "...", "name": "...", "description": null, "sort_order": 1,
      "items": [
        { "id": "...", "name": "...", "description": null,
          "price": "12.50", "image_path": "restaurant/<rid>/item/<iid>/<file>.webp",
          "is_offered": true, "unavailable_reason": null,
          "extras": [ {"id": "...", "name": "...", "price_adjustment": "0.00",
                       "sort_order": 1} ] } ] } ] }
```

`unavailable_reason` is `"restaurant"` when the hard stop applies, `"branch"`
when the branch's own override hides the item, and `null` otherwise.
`is_offered = availability §2`. Prices are text with two decimals (see §9).

**Rationale**: This is the exit condition's artifact — "the customer menu
reflects the current published availability" — made demonstrable and testable
in one round trip (SC-008). `security invoker` mirrors the precedent set by
`public.current_auth_context` (feature 003): it authorizes explicitly, but even
a mistake in that check can only expose rows the caller's policies already
allow, because RLS applies inside it. A `security definer` reader would make
the explicit check the *only* barrier.

**Rejected**: a `security_invoker` view (a view cannot authorize per-branch
scope — it would leak a *wrong* availability answer for out-of-scope branches
rather than a denial, per §3); policy-only client joins (same problem, plus two
round trips); several `returns table` RPCs (the payload's ordering and nesting
are the contract; one call is one consistency point).

The payload carries **all** items with their computed availability, not just
the offered ones: staff need to see, in one place, what customers see and why
an item is missing. The customer view is the `is_offered = true` subset (the
UI's "customer view" toggle; feature `007` applies the same filter on the
public side).

---

## 6. Price changes: the append-only audit record is the price history

**Decision**: A price change is an audited operation, not a new table. When
`update_menu_item` detects that the price actually changed, it writes an audit
record with action `menu.item_price_changed` and a deterministic change string
in `reason` (`price: 12.50 -> 15.00`); when only name/description changed it
writes `menu.item_updated`. Saving an unchanged price writes nothing at all
(FR-016's "MUST NOT produce a recorded change").

**Rationale**: FR-016 requires the change to be recorded with actor, time,
item, previous price, new price, and scope — every one of which the existing
`audit_log` row carries (`actor_profile_id`, `created_at`, `resource_id`,
`reason`, `restaurant_id`). Feature 002's foundation already defines `reason`
as optional free text and master plan §37 lists "change/reason" as the
requirement, so a formatted string is within the approved contract, and the
database tests read `audit_log` directly (feature 004's precedent).

Feature `008`'s session price-lock policy does **not** need a queryable price
history: the approved mechanism is snapshots — the price is captured into the
session/round when it is created (§15 "apply the correct price snapshot", §35
"stale price", §47 Risk 6 "preserve required snapshots"). A history table would
be a second, unused source of the same facts.

**Rejected**: a `menu_item_price_history` table (real complexity — a table,
policies, grants, RPC effects, tests — with no consumer: snapshots are the lock
mechanism, and reports are not in V1 scope); adding a structured `change jsonb`
column to `audit_log` (touches feature 002's frozen contract, requires
drop/recreate of `private.record_audit`, and §37 explicitly allows
change-or-reason — deferred until a feature must *query* the change). The
residual — a change string is not machine-parsed beyond the documented format —
is recorded as a follow-up note (§18).

---

## 7. Ordering: `sort_order` with a deterministic tiebreak, reordered as a set

**Decision**: `menu_categories.sort_order` and `menu_items.sort_order` are
`integer not null default 0`, non-unique; reads order by
`(sort_order, created_at, id)`; extras order by `(sort_order, name, id)`.
Reorder RPCs take the complete ordered id list for their scope
(`reorder_menu_categories(restaurant, ids[])`, `reorder_menu_items(category,
ids[])`), validate that the list covers exactly the scope's rows with no
duplicates, and assign `1..n` in one transaction.

**Rationale**: FR-009 requires a deterministic order that staff can maintain.
Unique positions would make every insertion a rewrite with deferred constraints
or an error; non-unique positions with a total tiebreak are stable and simple.
The set-based reorder makes the stored sequence exactly the submitted one —
"the new order persists" is checkable — while the RPC's coverage validation
prevents a partial list from silently reordering only some rows. Creating an
item appends it (`max(sort_order) + 1` within the scope) so creation is
deterministic too.

**Rejected**: `numeric` fractional positions (need periodic rebalancing, and
the exactness is not worth it at this scale); drag-and-drop granular moves
(`move before X` operations multiply the RPC surface for the same result);
unique positions with `deferrable` constraints (fails on any write outside the
RPC and complicates the seed).

---

## 8. Validation bounds and the error model

**Decision**: The spec's requirements that bounded values exist are fixed here
(FR-008, FR-019; the exact figures are plan-owned):

| Value | Bound | Where enforced |
|-------|-------|----------------|
| Category name | required, ≤ 80 chars after trim; unique per restaurant case-insensitively | check + expression unique index + RPC message |
| Category description | optional, ≤ 500 chars; whitespace-only → absent | check + RPC |
| Item name | required, ≤ 120 chars after trim; **not** unique (Assumptions) | check + RPC |
| Item description | optional, ≤ 1000 chars; whitespace-only → absent | check + RPC |
| Item price | required, `0 ≤ p ≤ 999999999.99`, at most 2 decimals | check + RPC (explicit, see §9) |
| Extras per item | ≤ 20 | RPC, serialized by an item-row lock |
| Extra name | required, ≤ 80 chars after trim | check + RPC |
| Extra adjustment | `0 ≤ p ≤ 999999999.99`, at most 2 decimals | check + RPC |
| Image object | ≤ 5 MiB; `image/jpeg`, `image/png`, `image/webp` | bucket config (§4) + RPC path validation |
| Image path | `restaurant/<rid>/item/<iid>/<name>.<ext>` with `name` ≤ 120 chars from `[A-Za-z0-9._-]` | RPC + table check |

Error model, unchanged from 004: `42501` for every authorization denial (wrong
role, other restaurant, other branch, no linked profile, out-of-scope branch in
the read projection), `P0001` for validation failures and for every constraint
violation the functions can hit (caught by constraint name), with the
constraint remaining the declarative backstop for any other writer.

**Rationale**: Every bound is either expressible as a table check (lengths,
ranges, path shape) — which protects against any writer — or is a cross-row
rule (extras count, reorder coverage) that the RPC enforces under a lock. The
extras bound is the only racy one; it is closed by taking the item row
`for update` inside `add_menu_item_extra`, the same serialization discipline
feature 004 used for the last-owner safeguard.

**Rejected**: a trigger-maintained counter for the extras bound (a trigger for
one rule, when all writes already flow through one function); 255-char
"whatever the column allows" limits (the spec requires documented bounds, and
unbounded names break the preview layout).

---

## 9. Money: `numeric(12,2)`, strings on the wire, no client arithmetic

**Decision**: Prices and adjustments are `numeric(12,2)` with
`check (price >= 0)`. Values cross the wire as **strings** in both directions
(`"12.50"`), validated by the client against
`^\d{1,9}(\.\d{1,2})?$` and cast by the database. The RPC rejects a value with
more than two decimals rather than letting `numeric(12,2)` round silently:

```sql
if p_price <> round(p_price, 2) then
  raise exception 'A price may have at most two decimal places.';
end if;
```

The client performs **no floating-point arithmetic** on money in this phase:
`src/features/menu/money.ts` validates, canonicalises, and formats (for display
only, via `Intl.NumberFormat` on a parsed number); sums are not computed
client-side anywhere in this phase, and the features that must total amounts
(tax, rounds, bills) compute in SQL.

**Rationale**: `numeric` is exact decimal arithmetic in PostgreSQL, which is
what the tax engine (`006`) and rounds (`008`) will need; the rejected
alternative (integer minor units) forces conversion at every boundary and can
not represent a currency whose minor unit differs. Two decimals matches the
single V1 currency assumption; three-decimal currencies would be a schema
change, recorded as a follow-up (§18). The string wire form removes the
`Number` round trip that would otherwise make `0.07` an approximation.

**Rejected**: `double precision` (drift — FR-010 forbids it); integer cents
(conversion noise, currency inflexibility); a decimal library dependency
(Constitution VIII; the client does no arithmetic yet).

---

## 10. Item images: one optional image per item, replaced by reference swap

**Decision**: `menu_items.image_path text` (nullable) holds at most one object
path, guarded by a table check that the path starts with
`restaurant/<restaurant_id>/item/<id>/` — a row-level check that needs no
subquery. A partial unique index on `image_path` (where not null) prevents two
items from ever referencing the same object. The client-side flow:

1. pre-checks type/size locally (immediate feedback);
2. uploads to `restaurant/<rid>/item/<iid>/<uuid>.<ext>` through the Storage
   API (bucket limits and the insert policy are the authoritative checks);
3. calls `set_menu_item_image(p_item_id, p_image_path)`, which validates the
   path against the item, records the new reference, audits
   (`menu.item_image_changed`, change string per §6), and returns the previous
   path;
4. deletes the previous object through the Storage API, best-effort.

**Rationale**: This is the minimal shape that satisfies FR-021/FR-022 — at most
one image, no broken references (the row is only ever written with a path that
matches its own item and, for uploads, an object that already exists), and the
previous file becoming unretrievable (§11 makes that a policy consequence, not
a cleanup race). Storing the path rather than a bucket-relative key keeps the
tenant binding visible in the data.

**Rejected**: an `item_images` table with history (the spec's lifecycle is
replace/remove, and FR-022 requires the old file to become unreachable — a
history table contradicts it); a separate `clear_menu_item_image` RPC (clearing
is `set_menu_item_image(..., null)` — one operation, one audit action);
uploading through a database function (impossible: object bytes are written by
the Storage service, and deleting objects via SQL is explicitly unsupported).

---

## 11. Storage policies: the current reference is the read permission

**Decision**: Four policies on `storage.objects`, all scoped to
`bucket_id = 'menu-images'` and to the path grammar
`restaurant/<restaurant_id>/item/<item_id>/<file>`:

| Policy | Operation | Predicate (abridged) |
|--------|-----------|----------------------|
| `menu_images_staff_select` | select | the object's `name` equals some `menu_items.image_path` whose `restaurant_id` is in `private.staff_restaurant_ids(auth.uid())` |
| `menu_images_owner_insert` | insert | path prefix parses to a restaurant in `private.owned_restaurant_ids(auth.uid())` |
| `menu_images_owner_delete` | delete | path prefix parses to a restaurant in `private.owned_restaurant_ids(auth.uid())` |
| (none) | update | replacement is insert + delete, so no update policy exists |

The select predicate's join to `menu_items` runs under the caller's own RLS
(menu items are staff-readable within the restaurant), so the two layers agree:
an object is readable only while a visible item references it, and only by
staff of that restaurant. Path prefixes are compared as text with a UUID-shape
guard before any cast, so a malformed path cannot raise inside a policy.

**Rationale**: This is what makes FR-022's "the previous file is no longer
retrievable" true **immediately** when the reference moves, even though the
bytes are deleted asynchronously by the client. It also gives FR-023's
"not enumerable across restaurants" a structural answer: there is no policy
under which an unreferenced or foreign object can be listed or fetched.

Grants are **not** added: the Storage service's own migrations grant table
privileges on `storage.objects` to `authenticated` (documented in the access
control guide and visible in `supabase/storage`'s tenant migrations); policies
alone are the access decision. The integration suite proves this on the live
project rather than trusting the claim (§14).

**Rejected**: a public-read policy for offered items now (feature `007`'s
decision, and FR-004 forbids public exposure in this phase); signed URLs
(unnecessary — an authenticated GET with a select policy reads a private object
directly; signed URLs arrive when the *unauthenticated* customer surface needs
them); scoping reads by path prefix alone (a replaced object would remain
readable to staff forever, failing FR-022).

**Residual (documented, not silently accepted)**: a delete that fails after the
reference moved leaves bytes in the bucket with no reader — invisible to every
client, reclaimable by an owner delete, and bounded by the bucket's own
listing in the dashboard. A garbage-collection sweep is deliberately not built
(no consumer, and storage cost is trivial at this scale).

---

## 12. Migration structure: four focused migrations

**Decision**:

1. `<ts>_menu_schema.sql` — the four tables, constraints, indexes, RLS enabled,
   and `revoke all … from anon, authenticated` for each (the deny-by-default
   posture established at creation, before any policy exists).
2. `<ts>_menu_policies.sql` — `grant select` to `authenticated` and the four
   select policies.
3. `<ts>_menu_media.sql` — the bucket row and the four `storage.objects`
   policies.
4. `<ts>_menu_rpcs.sql` — `private.branch_manager_branch_ids`, the fourteen
   write RPCs, `get_branch_menu`, and the execute grants.

**Rationale**: Matches feature 004's discipline (one concern per migration, each
reviewable and independently reversible in a reset) and keeps the storage
surface separable from the relational one. The helper lives with the RPCs that
use it; no existing migration is edited.

---

## 13. Seed extension: the demo menu

**Decision**: `supabase/seed.sql` gains a deterministic menu for **Blue Olive**
(restaurant-level, shared by its branches), with fixed UUIDs exported through
`tests/database/helpers/fixtures.ts`:

| Object | Values |
|--------|--------|
| Categories | Starters, Mains, Desserts, Drinks (ordered) |
| Items | 10–12 items across the categories with descriptions and two-decimal prices, e.g. hummus, grilled halloumi, lamb kebab, grilled sea bass, chocolate fondant, mint lemonade |
| Extras | three on one item (one free, one paid, one priced at the bound's edge), two on another — proving item-scoping |
| Restaurant-wide stop | one item `is_available = false`: unavailable at **every** branch, including Marina (the seeded branch with its own override) — the hard stop is visible in the fixture |
| Branch override | one item unavailable at Marina only; available at Downtown and Airport |
| Cedar Grill | its own smaller menu (proves isolation: no item, category, extra, or override crosses tenants) |

**Rationale**: FR-028 asks for a fixture that demonstrates the phase with zero
manual setup, and the `db:seed` summary should count the new tables. The
override fixture is deliberately arranged so the hard stop wins over an
existing override row (the clarified rule) — a fact both the database tests and
the walkthrough assert.

**Images are not seeded** — see §16.

---

## 14. Test strategy across the four tiers

**Decision**:

| Tier | New/changed | What it proves |
|------|-------------|----------------|
| Database (`tests/database/`) | `menu.schema.test.ts` (new), `menu.rpc.test.ts` (new), `helpers/fixtures.ts` (extended) | Declared shapes, constraints, indexes, policies, the bucket row and its limits; then the 14-RPC matrix inside rolled-back transactions: authorization for every role × scope combination, validation bounds and messages, the hard-stop precedence over an existing override, override set/clear/no-op, cross-branch non-interference, reorder coverage and determinism, no-op writes producing no audit rows, one audit record per accepted change with its action/scope/change string, and the `get_branch_menu` payload shape and ordering |
| Integration (`tests/integration/`) | `menu.images.test.ts` (new) | The real Storage round trip with a real owner session: upload to the owner's prefix (accepted), authenticated read of the referenced object, bucket-limit rejections (oversized, wrong type), a second restaurant's member denied insert/read/delete, a non-owner branch manager denied insert, and — the load-bearing one — a replaced object unreadable after the reference moves |
| Unit (`tests/unit/`) | `menu.client.test.ts` (new) | Money validation/canonicalisation/formatting, branch-menu payload parsing (including malformed payload rejection), RPC error mapping (`42501` → authorization message, `P0001` → validation message), image path building |
| E2E (`e2e/`) | `menu.surfaces.test.ts` (new) | The read-and-reject presentation matrix in a real browser: the owner's menu surfaces render the seeded menu, the branch customer view excludes the stopped item and shows the override-hidden item as missing, a branch manager sees availability controls for their branch only, and non-owners (cashier, kitchen, other tenant, super admin) reach NotAuthorized — **no tenant writes**, matching the established e2e rule |

**Rationale**: The write journeys cannot be created in the e2e tier without
abandoning the no-write rule that keeps that suite deterministic against the
shared cloud database, so they are proven where they are strongest — in
rolled-back database transactions and a real-API integration round trip — and
walked manually in the quickstart. The storage policies are additionally
exercised at the SQL level in the schema suite where a simulated identity can
read `storage.objects` under RLS, with the integration tier as the real proof.

---

## 15. Client surfaces, predicates, and cache discipline

**Decision**: One feature module `src/features/menu/` and two routes:

- `/dashboard/menu` — owner-only management (structure, items, prices, extras,
  images, restaurant-wide availability, and any branch's overrides);
- `/dashboard/branches/:branchId/menu` — the branch projection with the
  customer-view filter, plus availability controls when the caller is an owner
  or that branch's manager.

Two presentation-only predicates join `canManageRestaurant` in
`src/features/auth/useAuthContext.ts`:
`canViewBranchMenu(branchId)` (owner, or any branch-scoped membership on that
branch) and `canManageBranchAvailability(branchId)` (owner, or a
`branch_manager` membership on that branch). React Query keys are scoped by
restaurant and branch; mutations invalidate the menu tables they touched and
always the branch projection(s) of the affected restaurant, so the preview can
never show a pre-change availability after a mutation settles.

**Rationale**: Guards are presentation-only (Constitution IV) — every surface
renders what the data layer allows and the RPCs/policies remain the boundary;
the e2e matrix asserts that a deep link outside scope renders NotAuthorized
rather than a hidden control (feature 004's precedent). Invalidation by
restaurant keeps the exit condition's promise ("the customer menu reflects the
current published availability") true for the UI without polling or realtime.

---

## 16. Spec reconciliations (recorded, not silent)

**Decision**: Two spec sentences were updated during planning, because the
clarified rules and the seed's constraints made them unsatisfiable as written:

1. **FR-028 / SC-007 (seeded image)** — the seed writes to the database only
   (it connects with `SUPABASE_DB_URL`; the project forbids service-role keys,
   research §4 of feature 004). Seeding an `image_path` without uploading the
   object would leave an item referencing a missing file, violating FR-021's
   "never a broken reference" and making the exit-state fixture produce broken
   UI. The seed therefore demonstrates menu content, extras, the restaurant-wide
   stop, and the branch override; the image journey is proven by the
   integration round trip (§14) and one upload in the walkthrough
   (quickstart.md). The image feature itself remains fully in scope — only the
   fixture claim changed.
2. **FR-028 / SC-007 (override "in each direction")** — written before the
   clarification that made the override one-directional. It now requires "at
   least one item unavailable restaurant-wide" and "at least one item available
   restaurant-wide but unavailable at a single branch", which is what the
   clarified rule can express and what §13 seeds.

**Rationale**: Constitution II makes the specification the source of business
truth; leaving an unsatisfiable requirement would force the implementation to
either fail the phase gate or silently deviate. The reconciliations are stated
here and in the spec's own text so `$speckit-analyze` and `$speckit-converge`
can verify them.

---

## 17. Scope discipline: what this plan deliberately does not build

- No tax, tax-inclusive pricing, or rounding — feature `006` (prices here are
  base amounts).
- No session price lock, order/round price snapshots, or cart — features `007`
  and `008`; this phase preserves the audit record they build on (§6).
- No realtime propagation of menu or availability changes — feature `012`; the
  preview is correct on every read (§5), which is this phase's guarantee.
- No public menu surface, no signed URLs, no anonymous storage access —
  feature `007`'s decisions (§4/§11).
- No cashier or kitchen availability actions — feature `009` (master plan §19).
- No bulk import/export, menu printing, or translation; no item deletion,
  no category deletion while non-empty, no menu archival or versioning.
- No per-branch menus or prices, no multiple menus per restaurant, no scheduled
  availability (spec Out of Scope; clarified 2026-09-17).
- No extras groups, required selections, or min/max rules (§8 bounds only);
  no free-text customer instructions.
- No multi-currency, no per-restaurant currency setting (§9).
- No menu-image garbage collection sweep and no storage-usage reporting
  (§11 residual).

---

## 18. Follow-up notes (not Phase 4 scope)

- **Structured audit change**: if a later feature must query what changed
  (rather than read it), the audit foundation gains a structured change column
  then — the change strings of §6 are the interim contract.
- **Storage garbage collection**: unreferenced objects are unreadable but not
  reclaimed (§11); a sweep belongs with the performance/reliability phase.
- **Three-decimal currencies**: `numeric(12,2)` assumes the V1 currency's minor
  unit is two decimals (§9); supporting another would be a schema and display
  change.
- **Image content sniffing**: the bucket validates the declared MIME type and
  extension, not magic bytes (§10); if abuse appears, the storage phase adds
  server-side verification.
- **Public image delivery**: signed URLs or a public-read policy for offered
  items are feature `007`'s call (§4/§11).
