# Specification: Security Hardening (Phase 14)

**Feature dir**: `specs/015-security-hardening` | **Created**: 2026-09-22
**Input**: Master plan §25 — an explicit security review after the major
business flows exist. This is a review-and-prove phase: the product's
authorization architecture is already built (Phases 2–13); Phase 14's job is
to attack it systematically, encode every attack as a permanent regression
test, and fix anything that falls.

## Clarifications resolved at specify time

The spec defaults to the master plan's own terms and the house conventions
(generic refusals, indistinguishable errors, read-time derivation), which
resolve everything the draft raised: "security test suite" = the permanent
house suites (`tests/database/security.*.test.ts` + the walkthrough
discipline), "no known critical bypass" = every §25 review area exercised
in code with adversarial probes passing, and the seven review areas map
onto the deployed surface as written — no product-behavior changes are
authorized here beyond closing a proven bypass.

## User stories

### US1 — Tenant isolation holds under direct attack (P1)

An attacker with valid credentials in one restaurant attempts every
cross-restaurant operation the API surface permits: staff RPCs addressed to
another restaurant's branches/tables/rounds, table writes with foreign ids,
and customer tokens across sessions and restaurants. Every attempt is
refused with the generic refusal; nothing leaks existence beyond the
documented messages.

**Why**: §25's first review area; the architecture's whole promise.

### US2 — Role boundaries hold against privilege escalation (P1)

A cashier attempts kitchen/cashier/manager/owner operations; a kitchen
staff member attempts cashier and manager operations; a branch manager of
one branch attempts the sibling branch and owner-only operations (menu
writes, reports of the other branch, staff management, subscription
reads/writes, platform console). Every escalation is refused.

**Why**: §25's role-bypass area — the RBAC matrix proven adversarially.

### US3 — Client bypass gains nothing (P1)

Every UI action is re-driven directly against the data API with crafted or
omitted arguments: RPCs with parameter shapes the UI never sends, negative
or huge quantities, oversized strings, malformed JSON shapes, direct table
writes to privileged columns. The server's validation chain refuses each;
no direct call achieves what the UI cannot.

**Why**: §25's client-bypass + input-validation areas; the server is the
only authority (Constitution II).

### US4 — Session and token abuse fails closed (P1)

Guessed or fabricated session tokens, tokens from closed sessions, tokens
replayed after session close or round completion where the contract forbids
it, cross-session and cross-table access, and expired/unknown tokens all
refuse with the indistinguishable "no longer available" shape; no token
grants access outside its session.

**Why**: §25's session-abuse area — the token is the customer's only
authority, so its failure modes must be exactly closed.

### US5 — Secrets stay out of the client; the audit trail is append-only (P1)

The built frontend bundle and the public environment expose no privileged
credentials (service keys, DB URLs, platform secrets) — the client carries
only the publishable key and public URLs. Through the normal application
permissions no identity can UPDATE or DELETE audit rows; the trail is
append-only for everyone.

**Why**: §25's secrets + audit-integrity areas; both are one-directional
guarantees that a single regression test pins each.

## Requirements

- **FR-001**: The security suite attempts and proves refused: cross-
  restaurant RPC reach for staff identities, foreign-tenant table writes,
  cross-restaurant customer-token use (tenant isolation).
- **FR-002**: The security suite attempts and proves refused: every
  upward role escalation (cashier→kitchen→manager→owner) on representative
  operations of each level (role bypass).
- **FR-003**: The security suite attempts and proves refused: direct API
  calls with UI-impossible arguments — malformed cart shapes, out-of-range
  quantities, unknown/unavailable items, foreign extras, invalid status
  transitions, oversized text, malformed customer data (client bypass +
  input validation).
- **FR-004**: The security suite attempts and proves refused: guessed,
  fabricated, closed-session, and cross-session tokens; cross-table access;
  replay where the contract forbids it (session abuse).
- **FR-005**: The build output contains no privileged secret: the only
  credentials in client-reachable env/bundles are the publishable key and
  public URLs; `service_role`/DB/SMTP credentials are absent (secrets).
- **FR-006**: No application identity (staff or customer token path) can
  UPDATE or DELETE `audit_log` rows — grants, policies, and RPCs all fail
  closed; only the inline server-side writes create rows (audit integrity).
- **FR-007**: Every probe that finds a real bypass is fixed in the same
  phase, with the fix's regression test added; the master plan's exit
  condition (suite passes, no known critical bypass) is re-verified by the
  full gates.

## Non-goals (this phase)

- No new product features; no UX changes. Fixes are authorization/validation
  corrections only.
- No performance work (§26 is Phase 15), no penetration testing of the
  hosted Supabase infrastructure itself (platform responsibility), no
  dependency CVE sweeping (housekeeping, separate).
