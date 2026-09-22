# Implementation Plan: Security Hardening (Phase 14)

**Feature**: `015-security-hardening` | [Spec](spec.md) | Created 2026-09-22

## Summary

Phase 14 is an adversarial audit of the deployed authorization architecture
(65 public RPCs, RLS on every table, token-scoped customer access, the
platform flag). Seven §25 review areas become four permanent security test
suites plus two build/posture assertions; every probe encodes a §25 attack,
and any proven bypass is fixed in the same phase (FR-007).

## Architecture decisions

- **D1 — Probes as permanent suites, not a one-off script.** Each review
  area lands in `tests/database/security.*.test.ts` named after the area
  (isolation, roles, session, validation), so the exit condition "security
  test suite passes" is a standing `test:db` state, not a past event. The
  suites use the house pg helpers (`asUser`/`asAnon`/`inTransaction`,
  fixtures) and the real PostgREST path where grants matter.
- **D2 — The PostgREST path is the attack surface.** Probes run as the
  real roles (`anon`/`authenticated` with fixture JWTs) through
  `supabase-js` or role-set pg sessions, because RLS + grants + function
  `security definer` interplay is exactly what a bypass would exploit.
  Direct `postgres`-role connections are used only to ARRANGE state.
- **D3 — Secrets posture is asserted, not inspected.** A vitest unit suite
  globs the built `dist/` bundle + the client-reachable env for
  `service_role`/`SUPABASE_DB_URL`/password-shaped strings and fails if
  any appears (FR-005 is a regression test, not a checklist item).
- **D4 — Audit immutability is probed at every door.** RLS deny-all +
  revoked table grants + the absence of any UPDATE/DELETE path — all three
  probed from `anon`, `authenticated`, and the customer-token RPC surface
  (FR-006).
- **D5 — Fixes follow the house repair discipline.** A proven bypass gets:
  the minimal authorization fix (migration edit if pre-seed, else a new
  migration), its regression test converted from "expected refusal" to
  encoding the fixed behavior, and the verbatim-refusal contract preserved.
  No message changes, no behavior changes beyond the close.

## Attack matrix (review area → suite → representative probes)

| §25 area | Suite | Probes |
|---|---|---|
| Tenant isolation | `security.isolation.test.ts` | alice (Blue Olive owner) → Cedar Grill RPCs across menu/branch/staff/session/report surfaces; foreign-tenant table writes; customer token from restaurant A used against restaurant B surfaces |
| Role bypass | `security.roles.test.ts` | carla (cashier) → kitchen/cashier-adjacent/manager/owner ops; dan (kitchen) → cashier ops; bob (Downtown manager) → Marina ops + owner-only ops (menu writes, staff mgmt, subscription/platform) |
| Client bypass + input validation | `security.validation.test.ts` | `submit_round` with malformed/oversized/foreign carts; unknown ids; quantity bounds (0, 99+, non-numeric, huge); invalid lifecycle transitions; oversized display names/addresses; malformed tokens; direct table writes to privileged columns |
| Session abuse | `security.session.test.ts` | guessed tokens (sequential/predictable patterns), fabricated hashes, closed-session token reuse, cross-session round submission, cross-table token use, token after `close_session` |
| Secrets | `tests/unit/security.bundle.test.ts` | glob `dist/**/*` for privileged credential patterns; assert client env exposes only publishable values |
| Audit integrity | inside `security.isolation.test.ts` | UPDATE/DELETE on `audit_log` as anon/authenticated/staff; direct insert without the validated path |

## Testing strategy

The suites join `npm run test:db` (D1) and `npm run test:unit` (D3), so
`npm run verify` is the exit-condition gate. E2E is out of scope for this
phase except where a fix changes UI-visible behavior (none authorized).

## Risks

- **R1**: Probing `submit_round` validation could mutate state on a probe
  that unexpectedly passes → each validation probe runs inside
  `inTransaction` rollback, matching the house db-suite discipline.
- **R2**: A proven bypass requiring a migration change re-runs the full
  reset→seed→regression chain (T008 determinism gate) — budgeted.
- **R3**: The secrets suite globbing `dist/` requires a build first — the
  suite skips cleanly (not silently passes) when `dist/` is absent, and
  `npm run verify` runs build before test:unit? No — verify's order is
  format/lint/typecheck/unit/db/integration/build; the suite therefore
  asserts against `dist/` when present and, when absent, asserts the
  SOURCE env contract (`src/` + `.env` key NAMES only, never values) —
  both directions permanent.
