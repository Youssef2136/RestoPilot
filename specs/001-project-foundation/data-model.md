# Data Model: Project Foundation (Phase 0)

**Feature**: 001-project-foundation | **Date**: 2026-09-15

Phase 0 deliberately contains **no business-domain entities** (spec Out of
Scope; Constitution Principles I and VIII). The single object below exists
solely to prove the migration → seed → type-generation → database-test
pipeline (FR-007, FR-008, FR-009, FR-013). Business schema design belongs to
Phase 1 (002-database-and-tenancy).

---

## Entity: `app_meta` (table `public.app_meta`)

Non-business key/value metadata used as the pipeline proof and, later, as a
general system-metadata surface for non-domain entries. It must never hold
business data.

| Field | Type | Constraints |
|-------|------|-------------|
| `key` | `text` | **Primary key**, not null |
| `value` | `text` | Not null |
| `updated_at` | `timestamptz` | Not null, default `now()` |

**Row Level Security**: **enabled, with no policies** — deny-by-default for
`anon` and `authenticated` roles. The table owner (the connection used by
migrations, seed, and database tests) bypasses RLS by default ownership
semantics, so pipeline tooling is unaffected while the public API surface
exposes nothing.

**Validation rules**:
- `key` unique (primary key); seed writes are idempotent
  (`on conflict (key) do nothing`).
- No application-level writes are defined in Phase 0 — only migrations and
  seed write to this table.

**Relationships**: none. No foreign keys to or from business tables, ever
(it is not business data).

**State transitions**: none — static metadata.

**Seed row**: one row, `('foundation', 'seeded')`, applied by
`supabase/seed.sql` via `npm run db:seed`. Its presence is asserted by the
Phase 0 database-level test (see [research.md](./research.md) §12).

**Migration source**: `supabase/migrations/<timestamp>_app_meta.sql`
(created via `supabase migration new`, applied to the cloud development
database via `supabase db push`).

**Generated types**: `src/types/database.types.ts` (from
`npm run types:gen`) exposes `app_meta` row type; the type file must
regenerate identically after a full reset/rebuild (FR-009).

---

## Supabase-managed objects

Supabase system schemas (`auth`, `storage`, `realtime`) exist on the cloud
project but are **not modified or used** in Phase 0. No Auth users, no
Storage buckets, no Realtime channels are created — those belong to later
phases.
