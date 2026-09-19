# Implementation Plan: Menu Management (Phase 4)

**Branch**: `005-menu-management` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-menu-management/spec.md`, including the Clarifications of 2026-09-17 (one shared restaurant menu; restaurant-wide unavailability as a hard stop that no branch override can reverse; owners maintain all content and prices while branch managers manage availability for their own branch only; one deployment-wide currency; flat, independently selectable extras). The feature builds directly on feature 002 (tenancy schema, RLS conventions, private scope helpers, append-only audit foundation, canonical migration/seed workflow), feature 003 (identity linkage, role-aware policies, `current_auth_context`, the identity-provisioning contract), and feature 004 (restaurant/branch/table/staff configuration, the `security definer` management-RPC pattern with `private.record_audit`, and the owner-only configuration boundary). Backend remains **Supabase Cloud** (the Phase 0 owner directive: no local stack, no Docker); the spec's Assumptions defer the image bounds to this plan — resolved in [research.md](./research.md) §10. Two spec requirements were reconciled to the clarified rules and the seed's database-only scope (FR-028, SC-007) — recorded in [research.md](./research.md) §16.

## Summary

Deliver the Phase 4 menu domain on the existing tenancy foundation: the restaurant's **single shared menu** — categories and items with descriptions, prices, ordering, structured extras, and one optional image each — plus the **availability model** the exit condition turns on: a restaurant-wide state owned by the restaurant's owners, a per-branch override that can only mark an item unavailable at that branch, and a computed effective availability that the branch's customer-visible menu reflects on every read. Every content, price, extra, image, and availability action is enforced at the data layer (FR-002/FR-003) and audited (FR-024).

The implementation extends the existing schema rather than restating it: **four new tables** — `menu_categories`, `menu_items`, `menu_item_extras`, and `branch_unavailable_items` (presence is the override) — with the composite tenant/branch FK pattern, case-insensitive category-name uniqueness, a declarative path-shape check on an item's image, and an FK that makes deleting a non-empty category impossible. All writes flow through **fourteen `security definer` RPCs** in `public` — no client write grants are added anywhere — each authorizing its caller through the existing `private` helper family plus one new helper (`private.branch_manager_branch_ids`), calling `private.record_audit` in the same transaction, and translating constraint violations into clear messages (FR-005…FR-024). The branch's customer-visible menu is computed in the database by one **`security invoker` read RPC** (`get_branch_menu`) that authorizes scope explicitly and reads under the caller's own policies, so it can never disclose what the policies deny (FR-014/FR-015, Constitution III/IV).

Item images introduce the project's first **Supabase Storage** surface: one private bucket (`menu-images`) with declarative size and MIME-type limits, created by migration, with four `storage.objects` policies scoped by the tenant path prefix. The **current image path is the read permission**: an object is readable only while an item references it, so a replaced image becomes unretrievable the moment its replacement is recorded — no cleanup race can expose it. Deletion of the superseded file is a best-effort Storage-API call after the reference moves (deleting objects through SQL is unsupported — research.md §4/§11), and the residual is documented.

The frontend adds a `src/features/menu/` module and two routes: `/dashboard/menu` (owner-only management of content, prices, extras, images, restaurant-wide availability, and any branch's overrides) and `/dashboard/branches/:branchId/menu` (the branch's customer-visible menu — the exit condition's demonstrable artifact — with availability controls for owners and that branch's manager). Guards stay presentation-only (Constitution IV). Validation is proven in four tiers — the rolled-back database matrix over the fourteen RPCs and the projection, a real-API integration round trip against Storage (upload, read, cross-tenant denial, replaced-image unavailability), unit tests for money handling, payload parsing and error mapping, and a read-only browser matrix — with the full journey walkable from the seeded fixture (quickstart.md).

## Technical Context

**Language/Version**: TypeScript (React 19, Vite) for the application; SQL (PostgreSQL 17.6 on the configured Supabase Cloud project) for schema, policies, storage policies, and the fifteen functions.

**Primary Dependencies**: **No new runtime dependency.** `@supabase/supabase-js` already ships the Storage client used for image upload/read/delete; `@tanstack/react-query` (server state), `react-router` (routes), Supabase CLI (migrations, `gen types`), `pg` (database + integration tests), Vitest, Playwright, and pgcrypto (seed) are all in place. Money handling is written in-repo (`src/features/menu/money.ts`) rather than added as a library: amounts cross the wire as exact strings and the client performs no floating-point arithmetic (research.md §9).

**Storage**: Supabase Cloud PostgreSQL: the existing `public`/`private` schemas plus four tables (`menu_categories`, `menu_items`, `menu_item_extras`, `branch_unavailable_items`), one private Storage bucket (`menu-images`), and four policies on `storage.objects`. No new schemas, no new columns on existing tables, no changes to any existing policy, grant, or function. Supabase Realtime remains off (no table joins the publication — master plan §32; live propagation is feature `012`).

**Testing**: Four tiers, all extending existing suites/harnesses: database (`tests/database/` — the menu RPC matrix and the declaration-shape suite inside rolled-back transactions using the existing identity-simulation harness); integration (`tests/integration/` — a real Storage round trip with a real owner session: upload, authenticated read, replaced-image unavailability, cross-tenant and out-of-scope denials, scratch teardown); unit (`tests/unit/` — money parsing/formatting, branch-menu payload parsing, RPC error mapping); e2e (`e2e/` — read-and-reject presentation matrix, no tenant writes, matching the established rule). `npm run verify` remains the gate (unchanged scripts).

**Target Platform**: Supabase Cloud (region eu-west-1) + browser SPA (Vite dev server at `http://localhost:5173`); tests run from developer machines (Windows primary).

**Performance Goals**: Engineering guidance, not spec gates: the management surfaces read the menu tables directly under policies (one query per table, matching the existing initPlan form); the branch menu is **one** `get_branch_menu` round trip destined by SC-008's 2-second budget; the image path check is covered by a partial unique index; no new index on an existing table; the extended suites stay within the existing per-suite budgets.

**Constraints**: Supabase Cloud only (no local stack, no Docker); every schema/storage change through the single canonical migration workflow (FR-029) — storage policies are migrations, never dashboard edits; **no new environment variables**; **no service-role or secret keys anywhere** (the local seed cannot upload images — research.md §16); **no new npm dependency**; no client write grants on any table; the bucket is private (nothing becomes publicly readable in this phase — FR-004/FR-026); no Edge Functions (no server runtime beyond Postgres); no deletion of items, and category deletion only when empty; the seed stays idempotent, deterministic, and converging; route guards remain presentation-only.

**Scale/Scope**: Four migrations; four tables (+ policies, grants, RLS); one storage bucket + four storage policies; one new private helper; fourteen write RPCs + one read RPC; one new frontend feature module (4 modules + 6 components) and two route files plus the `src/app/router.tsx` edit and two small surface edits (dashboard navigation, branch detail link); one new client helper family (money); fifteen audit actions (fourteen operations, price changes recorded under their own action); four new test files plus the shared fixtures helper and the seed summary. No tax, session, ordering, kitchen, cashier, reporting, realtime, or super-admin surface (spec Out of Scope).

All technical unknowns were resolved through the research phase — see [research.md](./research.md) for decisions, rationale, and rejected alternatives, including the image-storage contract the spec deferred to this plan.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Business Scope Integrity | **PASS** | The menu is the approved ordering platform's own domain (master plan §6.3, §7.6–§7.7, §15). No payments, accounting, invoice printing, or inventory: prices are menu content, not a financial system, and no stock-keeping concept is introduced. |
| II | Specifications Are the Source of Business Truth | **PASS** | Every element traces to a spec FR (FR-001…FR-029) or a 2026-09-17 clarification. The bounds the spec deferred (image formats/size, description lengths, extras per item, ordering mechanics) are fixed in research.md §8/§10 within the spec's stated requirement that a documented bound exists and is enforced. Two spec sentences were corrected where the clarified hard-stop rule and the database-only seed made them unsatisfiable (FR-028, SC-007) — reconciliation recorded in research.md §16, not a silent change. |
| III | Multi-Tenant Isolation | **PASS** | The pattern is extended, not weakened: four new tables carry the composite tenant FKs (`menu_items` → `menu_categories(restaurant_id, id)`, `branch_unavailable_items` → `branches(restaurant_id, id)` and `menu_items(restaurant_id, id)`), every policy uses the wrapped `(select …)` initPlan form over the helper family, no existing policy or grant changes, and no client write grants appear. Storage objects are tenant-scoped by path prefix **and** by the live item reference (research.md §11). |
| IV | Server-Enforced Authorization | **PASS** | All fourteen write operations authorize inside `security definer` functions (owner-only content/prices; owner or that branch's manager for branch availability); the read projection is `security invoker`, authorizes scope explicitly, and reads under the caller's own policies. Guards and pages are presentation-only. Direct data-API and direct Storage calls outside scope are denied identically regardless of what the UI renders. |
| V | Database as the Source of Truth | **PASS** | Menu content, prices, extras, image references, and both availability levels live only in the database; the effective availability is computed server-side in `get_branch_menu` (`is_available and not exists(override)`), so no client computes a business-critical value. The client never becomes an independent source: uploads become authoritative only when the RPC records the reference. |
| VI | Explicit State and Data Integrity | **PASS** | Declarative first: composite FKs, case-insensitive category-name uniqueness, blank/length/price checks, the image-path shape check, `on delete restrict` making a non-empty category undeletable, and per-branch override uniqueness. Cross-row rules (extras bound, reorder completeness, effective availability) are enforced in serialized RPCs; each operation is one transaction; unchanged values are explicit no-ops that write nothing. |
| VII | Auditability of Sensitive Operations | **PASS** | Every accepted menu change produces exactly one append-only record through `private.record_audit` with actor, action, resource, tenant scope, and branch scope where applicable, plus a change string for price/availability/image edits (FR-016/FR-024; master plan §37 names price and availability changes). No client-readable audit path is added. |
| VIII | Minimal and Intentional Complexity | **PASS** | Four tables, one bucket, one helper, fifteen functions, **zero new dependencies**, no new runtime, no triggers, no views, no realtime, no generic CRUD layer, no new columns on existing tables. Rejected for being larger than the requirement: a price-history table, a structured audit-change column, a per-branch price model, extras groups, and signed-URL delivery (research.md §4/§6/§10/§11). |

**Post-design re-check (after research.md / data-model.md / contracts / quickstart)**: all eight principles still PASS. No gate violations; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-menu-management/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output — includes the image-storage contract the spec deferred
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── database-functions.md    # The 14 write RPCs + 1 read RPC + the new private helper
│   ├── menu-client.md           # App module, routes, money rules, guard/predicate rules
│   └── menu-images.md           # Bucket, path grammar, storage policies, upload/replace/delete flow
├── checklists/
│   └── requirements.md  # Spec quality checklist (unchanged by this command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

Contracts: this project exposes external interfaces on two sides — the data-API surface (the fifteen functions and the four new read policies, consumed by the SPA and by any direct data-API call) and the Storage surface (the bucket's limits, path grammar, and policies, consumed by the SPA's upload flow). Both are contracted, matching features 002–004.

### Source Code (repository root — changes for this feature)

```text
/
├── src/
│   ├── app/
│   │   └── router.tsx                     # CHANGED: /dashboard/menu (owner) and
│   │                                      #          /dashboard/branches/:branchId/menu (branch scope)
│   ├── features/
│   │   ├── auth/
│   │   │   └── useAuthContext.ts          # CHANGED: adds canManageBranchAvailability(branchId) and
│   │   │                                  #          canViewBranch(branchId) predicates (presentation-only)
│   │   └── menu/                          # NEW feature module (contracts/menu-client.md)
│   │       ├── menuClient.ts              # typed wrappers over the 15 functions; 42501/P0001 mapping;
│   │       │                              # branch-menu payload parsing into typed structures
│   │       ├── money.ts                   # exact price validation/canonicalisation/formatting (no float math)
│   │       ├── menuImages.ts              # bucket path builder; upload/replace/delete via the Storage API
│   │       ├── useMenu.ts                 # react-query hooks: restaurant menu reads, branch projection,
│   │       │                              # mutation invalidation rules
│   │       └── components/
│   │           ├── MenuStructurePanel.tsx # categories + items: create/edit/reorder/move
│   │           ├── MenuItemEditor.tsx     # one item: name, description, price, extras, image
│   │           ├── ExtrasEditor.tsx       # extras add/edit/retire
│   │           ├── ItemImageField.tsx     # upload/replace/remove with client-side pre-checks
│   │           ├── AvailabilityControls.tsx # restaurant-wide toggle + per-branch toggles with reasons
│   │           └── BranchMenuPreview.tsx  # the branch projection incl. customer-view filter
│   ├── routes/
│   │   ├── MenuPage.tsx                   # NEW: /dashboard/menu — owner menu management
│   │   ├── BranchMenuPage.tsx             # NEW: /dashboard/branches/:branchId/menu — preview + overrides
│   │   ├── DashboardPage.tsx              # EXTENDED: owner "Menu" navigation entry
│   │   └── BranchDetailPage.tsx           # EXTENDED: link to the branch's menu view
│   └── types/
│       └── database.types.ts              # REGENERATED (npm run types:gen) — 4 tables, 15 functions
├── supabase/
│   ├── migrations/
│   │   ├── … (thirteen existing migrations unchanged)
│   │   ├── <ts>_menu_schema.sql           # NEW: 4 tables, constraints, indexes, RLS enable, revokes
│   │   ├── <ts>_menu_policies.sql         # NEW: select grants + 4 select policies
│   │   ├── <ts>_menu_media.sql            # NEW: the private bucket + 4 storage.objects policies
│   │   └── <ts>_menu_rpcs.sql             # NEW: private.branch_manager_branch_ids; 14 write RPCs +
│   │                                      #      get_branch_menu + execute grants
│   └── seed.sql                           # EXTENDED: the demo menu (categories, items, extras,
│                                          #           restaurant-wide stop, one branch override)
├── scripts/
│   └── db/
│       └── seed.mjs                       # EXTENDED: menu counts in the summary
├── tests/
│   ├── database/
│   │   ├── helpers/fixtures.ts            # EXTENDED: menu ids and seeded values; new credential reuse
│   │   ├── menu.schema.test.ts            # NEW: declared shapes, constraints, indexes, policies, bucket row
│   │   └── menu.rpc.test.ts               # NEW: the 14-RPC matrix — authorization, validation, availability
│   │                                      #      semantics (hard stop, override set/clear, cross-branch),
│   │                                      #      ordering determinism, audit records, projection shape
│   ├── integration/
│   │   └── menu.images.test.ts            # NEW: real Storage round trip — owner upload/read/replace,
│   │                                      #      bucket limit rejections, cross-tenant + out-of-scope denials,
│   │                                      #      replaced-object unavailability; scratch teardown
│   └── unit/
│       └── menu.client.test.ts            # NEW: money rules, payload parsing, RPC error mapping,
│                                          #      image path building
├── e2e/
│   └── menu.surfaces.test.ts              # NEW: owner menu surfaces, the branch customer view excluding a
│                                          #      stopped item, a branch manager's own-branch availability
│                                          #      surface, non-owner/cashier/floor denials (read-and-reject)
├── docs/
│   └── development.md                     # EXTENDED: the storage bucket + policy changes are migrations,
│                                          #           the image round trip in the integration suite
└── package.json                           # UNCHANGED (no new dependency, no new script)
```

**Structure Decision**: No new top-level directories. Database work extends the `supabase/migrations/` + `seed.sql` layout; storage is configured by migration (never the dashboard); the frontend lands in the feature-module convention (`src/features/menu/`) with pages in `src/routes/`; tests extend the established four tiers. The bucket, its limits, and its policies are database-side constructs — no new repository directories.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. No Constitution violations were identified; no complexity requires justification. The additions that carry machinery — the Storage bucket plus four policies, the availability override table, and the `security invoker` read projection — are each the minimal documented mechanism for FR-021…FR-023 (image storage with controlled access and cleanup), FR-012/FR-013 (the clarified hard-stop availability model), and FR-014/FR-015 (a single scope-safe branch menu read), with alternatives evaluated and rejected in [research.md](./research.md) §4/§11/§12.
