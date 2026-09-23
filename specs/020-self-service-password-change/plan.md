# Implementation Plan: Self-Service Password Change

**Branch**: `020-self-service-password-change` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-self-service-password-change/spec.md`

## Summary

An authenticated identity changes their own sign-in password from inside the app: a
new session-bearing page (`/account/password`, deliberately not staff-gated — the
`/reset-password` precedent) reachable from the shell's signed-in navigation. The
`authClient` gains one new flow method — `changePassword({ currentPassword,
newPassword })` — that verifies the current password with a throwaway sign-in
attempt against the platform, then performs the platform credential update on the
page's own session. No schema changes, no new RPCs, no recovery-flow changes; two
new user-presentable message constants; tests prove the session matrix, zero
authorization drift, and every refusal.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (SPA, react-router v7)

**Primary Dependencies**: @supabase/supabase-js ^2.116 (GoTrue auth), TanStack Query (context RPC), Vite

**Storage**: Supabase Postgres (unchanged — feature touches only auth credentials; zero migrations)

**Testing**: Vitest (unit + database + integration), Playwright (e2e), `npm run verify` gate

**Target Platform**: Modern evergreen browsers (staff area + admin console users)

**Project Type**: Web application (frontend-only feature; the platform service is the auth backend)

**Performance Goals**: Change completes within one round-trip pair (verify + update), well under the SC-001 30s bound

**Constraints**: Single generic failure message except the distinct wrong-current-password case (spec FR-006); zero password material outside the credential transport (FR-010); no parallel auth mechanisms (spec Assumptions)

**Scale/Scope**: 1 new route + page, 1 nav link, 1 authClient method, unit + integration + e2e extensions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| I. Business Scope Integrity | ✅ | Credential management, not POS scope |
| II. Specs Are the Source of Business Truth | ✅ | Session semantics + message policy come from the spec, both probe-verified and user-decided |
| III. Multi-Tenant Isolation | ✅ | The operation targets the session's own account only; no tenant data is read or written |
| IV. Server-Enforced Authorization | ✅ | The platform enforces credential update (session) and password proof (sign-in attempt); the app layers UX only. Guards remain presentation; no guard gains authorization power |
| V. Database as Source of Truth | ✅ | The platform's auth store is the credential truth; the client keeps no password state |
| VI. Explicit State and Data Integrity | ✅ | The operation is verify-then-update with explicit in-flight/success/failure states; no partial client state |
| VII. Auditability | ✅ (n/a) | No tenant-sensitive operation; the platform's auth logging applies; no feature audit trail required by spec |
| VIII. Minimal and Intentional Complexity | ✅ | One method + one page + one nav link; reuses the existing module, message-constant pattern, and page structure; no new abstractions |

**Post-design re-check**: unchanged — the contract keeps `authClient` the only
`supabase.auth.*` import path and leaves `completePasswordReset` untouched.

## Project Structure

### Documentation (this feature)

```text
specs/020-self-service-password-change/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── auth-client.md   # Phase 1 output (extends the 003 module contract)
└── tasks.md             # Phase 2 output ($speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── features/auth/
│   └── authClient.ts                  # + changePassword, result types, message constants
├── components/
│   └── AppShell.tsx                   # + signed-in "Account password" nav link
└── routes/
    └── ChangePasswordPage.tsx         # new session-bearing page

tests/
├── unit/auth.change-password.test.ts  # client-mapping proofs (new file)
├── integration/auth.password-change.test.ts  # live session matrix + drift proof (new file)
e2e/
└── auth.routes.test.ts                # + the change-password walkthrough
```

**Structure Decision**: Feature-scoped additions inside the existing auth module and
route conventions — no new directories, no new feature folder.

## Complexity Tracking

> No constitution violations — nothing to track.
