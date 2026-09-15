# Quickstart: Database and Multi-Tenancy (Phase 1)

**Feature**: 002-database-and-tenancy | **Date**: 2026-09-15

Validation guide proving the Phase 1 data layer end-to-end. Expected outcomes map
to the spec's success criteria (SC-001 … SC-005). Design rationale lives in
[plan.md](./plan.md) and [research.md](./research.md); schema details in
[data-model.md](./data-model.md); the security suite's identity-simulation
mechanism was verified live against the cloud project during research.

---

## Prerequisites

Same as feature 001 ([its quickstart](../001-project-foundation/quickstart.md)):
Node 22 LTS+, npm, Git, Supabase CLI, and the one configured Supabase Cloud
development project with a working `.env` (four variables). No new tools, no new
secrets, no local database.

## Apply the tenancy layer

```bash
npm run db:migrate    # applies the three Phase 1 migrations (core → rls → audit)
npm run db:seed       # applies the extended supabase/seed.sql (idempotent)
npm run types:gen     # regenerates src/types/database.types.ts (six tables + staff_role)
```

**Expected outcome**: `db:migrate` reports the three new migrations applied on
top of the two Phase 0 ones; `db:seed` reports the tenancy fixture (Blue Olive /
Cedar Grill, branches, memberships, dining tables — [data-model.md](./data-model.md));
`types:gen` produces a committed, diff-stable types file (SC-005 fixture present,
zero manual setup).

## Run the security suite (SC-001, SC-003, SC-004)

```bash
npm run test:db
```

**Expected outcome** — exit code 0, with the suite organized as:

| File | Proves |
|------|--------|
| `tenancy.schema.test.ts` | Tables/columns/enum as designed; composite FKs reject cross-tenant references; role↔branch check; duplicate-membership rejection; unique slug; per-branch table-label uniqueness; deterministic ownership paths (spec US1) |
| `tenancy.rls.test.ts` | The §12 isolation matrix (spec US2, FR-011): **cross-restaurant** (Alice ✗ Cedar Grill), **cross-branch** (Bob ✗ Marina), **scope bypass** (crafted direct queries ✗ out-of-scope rows), **direct access** (the suite *is* direct database access — same roles/claims the API layer uses); within-scope reads allowed (Alice ✓ both branches; Eve ✓ Cedar Grill + Downtown — multi-membership); modeled super-admin gets nothing; `anon` denied everywhere; all client-role writes denied by grants on every table (SC-003: every tenant-owned entity covered) |
| `audit.test.ts` | `record_audit` captures all required fields with timestamp (SC-004); missing actor/action/resource/scope rejected with a clear error; `audit_log` and `record_audit` unreachable for client roles — append-only posture (spec US3) |
| `app_meta.test.ts` | Phase 0 baseline still intact (unchanged) |

The suite runs entirely in rolled-back transactions against the shared
development database — it leaves no residue and needs no manual fixtures
(research.md §1–2). A failing isolation test is a **security boundary failure**,
not a flaky test: fix before anything else (master plan §41 priority order).

## Full quality pipeline

```bash
npm run verify        # format:check → lint → typecheck → test:unit → test:db → build
npm run test:e2e      # unchanged Phase 0 route smoke tests (no UI change in this feature)
```

**Expected outcome**: exit code 0; regenerated types pass typecheck and build.

## Reset-and-rebuild determinism (SC-002, spec FR-014)

```bash
npm run db:reset      # destructive: drops schema + migration history, reapplies everything, reseeds
npm run types:gen     # diff against the committed file — must be unchanged
npm run test:db       # full suite passes on the rebuilt database
```

**Expected outcome**: running the reset twice in a row each time yields an
equivalent known-good database rebuilt purely from repository artifacts, and
`types:gen` output is byte-identical after each rebuild (spec FR-016). Run only
against the development project.

## Manual isolation demonstration (optional, one command)

```bash
npm run db:seed   # output lists the seeded tenants — the fixture SC-005 requires
```

The seeded actors and their expected visibility are tabulated in
[data-model.md](./data-model.md); every row of that table is asserted
automatically by `tenancy.rls.test.ts`, so the demonstration is normally just
reading the suite output.

## Failure-mode checks (spec Edge Cases)

- **Cross-tenant reference attempt** (e.g., a membership binding a role to
  another restaurant's branch) → rejected by the composite FK with a constraint
  violation — asserted by `tenancy.schema.test.ts`.
- **Duplicate restaurant slug / duplicate table label within a branch / exact
  duplicate membership** → rejected by unique constraints — asserted by the
  schema suite.
- **Incomplete audit write** (missing actor, action, resource, or scope) →
  rejected by `record_audit` with a message naming the field — asserted by
  `audit.test.ts`.
- **Partially migrated or manually modified database** → `npm run db:reset`
  restores the known-good state first ([docs/development.md](../../docs/development.md)).
- **Cloud project unreachable** → the database suite fails with the documented
  connectivity guidance (feature 001 behavior, unchanged).
