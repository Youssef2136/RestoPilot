# Tasks: Security Hardening (Phase 14)

**Feature**: `015-security-hardening` | [Spec](spec.md) | [Plan](plan.md)

**Conventions**: Tests follow the house suites; every probe runs as a real
role (`asUser`/`asAnon`/PostgREST) inside rollback transactions (plan D2,
R1). Each T-task ends with its checkbox marked and a one-line evidence note.

## Phase 1: Setup + survey

- [X] T001 Read §25, the deployed function inventory (65 public RPCs), the
      RLS/grant posture, and prior contracts' refusal vocabulary; set
      `.specify/feature.json`
- [X] T002 Survey notes: per-suite probe lists with the exact RPC/table
      targets per attack row (committed as the plan's attack matrix)

## Phase 2: The security suites

- [x] T003 `tests/database/security.isolation.test.ts` (FR-001 + audit
      integrity FR-006): cross-restaurant staff RPCs (menu, branch, staff,
      session, report, lifecycle surfaces) both directions; foreign-tenant
      table writes; customer token used across restaurants; audit UPDATE/
      DELETE/INSERT refused for anon/authenticated through grants + RLS
- [x] T004 `tests/database/security.roles.test.ts` (FR-002): cashier →
      kitchen/manager/owner ops; kitchen → cashier/manager ops; manager →
      sibling branch + owner-only ops (menu writes, staff mgmt,
      subscription/platform RPCs)
- [x] T005 `tests/database/security.validation.test.ts` (FR-003):
      submit_round malformed/oversized carts, quantity bounds, unknown/
      unavailable items, foreign extras; lifecycle transitions refused;
      oversized names/addresses; malformed tokens; privileged column
      writes
- [x] T006 `tests/database/security.session.test.ts` (FR-004): guessed/
      fabricated tokens, closed-session reuse, cross-session/cross-table
      access, replay after forbidden states
- [x] T007 `tests/unit/security.bundle.test.ts` (FR-005): the built bundle
      + source env contract carry no privileged credential

## Phase 3: Findings and fixes

- [x] T008 Run all suites; triage every refusal that doesn't come (a real
      bypass) — fix per plan D5 with regression tests; re-run the full
      chain (reset → seed → test:db) if a migration changed

## Phase 4: Gates + docs

- [x] T009 Full gates: `npm run verify` + full e2e (no UI change expected;
      the run proves it)
- [x] T010 `docs/development.md` Phase 14 entry; the security posture note
      (what is asserted where) in the house doc style
- [ ] T011 Determinism: reset → seed → full db regression → `types:gen`
      byte-identical
- [ ] T012 Post-implement analyze record + final commit

## Notes

- T008 evidence: all four db security suites + the bundle suite pass on
  the first full run after the isolation suite's fix round (the audit
  trail and token scope held; the only gap found — `has_branch_role`'s
  branch-manager membership check — was already closed by 009/010's
  branch-scoped sessions; no code change required).
- The exit condition is now standing: the security suites run inside
  `npm run test:db` / `test:unit` on every verify.
