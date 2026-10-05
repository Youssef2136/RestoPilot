# Phase 03 — Findings

Classification per the skill (CRITICAL/HIGH must fix; MEDIUM/LOW recorded).

## Resolved during the phase

| # | Severity | Class | Finding | Resolution |
| --- | --- | --- | --- | --- |
| F1 | HIGH | TEST | full-journey DB residue: same-day reruns accumulate duplicate "Harbor" branches in the journey tenant; one stuck behind `audit_log` then `dining_tables` FKs | FK-safe ordered cascade delete (kitchen_tickets → round_items → rounds → session_participants/tokens → sessions → dining_tables → branch extras → branches); journey-tenant branches back to the single legitimate one |
| F2 | HIGH | CODE | Session-close success regex matched TWO elements (inline `role="status"` + the new toast) → Playwright strict-mode failures in full-journey + session.surfaces | Assertions pinned to the inline `getByRole('status')` (Q3 contract: the toast host is deliberately `role="region"`, never a second status) |
| F3 | HIGH | CODE | CustomerShell retirement of the AppShell header removed the ONLY signed-out affordance from `/account/password` — the phase-020 walkthrough pins "Sign out" there (real regression caught by E2E) | CustomerShell session bar: a signed-in visitor gets the `authClient.signOut()` button — an account action, not a nav link (FR-01 zero-nav intact; no unit pin changes) |
| F4 | HIGH | TEST | Parallel-suite Fiona cascade: auth.routes' walkthrough poisons `fiona@restopilot.dev` (temp password) for its span while fullyParallel files sign that identity in → redirects to /signin across suites; one interrupted round left the poison LIVE (repaired via two-client setSession+updateUser script) | Shared resilient `signInAs` (bounded 3-attempt retry) wired into all 11 specs + cross-file `fionaLock` mkdir mutex: brief on every Fiona sign-in, held across the walkthrough's poisoned window AND the journey's whole span; auth.routes password describe serialized |
| F5 | HIGH | TEST | Cross-file T3 pileup: kitchen.cashier + bill.void + reports + realtime submit customers to the SAME seeded T3 concurrently; sibling round cards drift between lookups | reports rounds moved T3→T2 (T3's heavy users keep it) + reports US3 scoped to `data-round-id` (the bill.void.audit pattern) |
| F6 | MEDIUM | TEST | platform onboarding rerun: the seeded owner email already exists → RPC links it ("no credential issued") instead of minting the one-time credential the assertions require | Per-run unique owner email (`e2e-harbor-owner-<ts>@…`); the linked-identity branch stays covered elsewhere |
| F7 | MEDIUM | TEST | `signInAs` copies assumed every identity lands on `/dashboard`; the platform super admin lands on `/admin` | Shared helper waits for `/(dashboard\|admin)$/` |
| F8 | LOW | TEST | smoke.test.ts asserted the AppShell-era nav on `/`; `/` is now CustomerShell (no nav BY DESIGN) | Rewritten to the 023 contract: main visible, navigation count 0 |
| F9 | HIGH | TEST | Structural integration race: management.provisioning leaves its provisioned membership LIVE for the suite's span (afterAll-only cleanup by design) while auth.signin's staff-list matrix asserts the seeded set EXACTLY — parallel workers flip a coin (extra uuid in alice's readable ids, seen twice at the gate) | `test:integration` runs `--no-file-parallelism` (files serialized, tests inside files unchanged); unit/db suites stay parallel; the provisioning header's "60 seconds between runs" note is now structural |
| F10 | MEDIUM | ENVIRONMENT | The 31-worker vitest burst immediately after `db:reset` produced a transient connection pile-up (48 fails → rerun green; verified 516/516 + 38/38 + full verify) | Sequence recorded in validation.md: verify (which resets nothing) runs before E2E, or after `db:reset` with the burst settled; no code change |

## Remaining (recorded, non-blocking)

| # | Severity | Class | Finding | Disposition |
| --- | --- | --- | --- | --- |
| R1 | LOW | TEST | E2E residue (journey tenant, onboarded tenants) persists by plan D1 between runs; exact-seed DB suites therefore require a reset before their gate | Documented ordering discipline (validation.md); next phase may add a journey teardown helper |
| R2 | LOW | TEST | Impeccable launcher remains `detect`-only (critique/audit/polish unavailable) — same as phase 02 | Carried from phase-02 report; no new findings to act on |
