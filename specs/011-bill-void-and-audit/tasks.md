# Tasks: Bill, Void, and Audit (Phase 10)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data model**: [data-model.md](data-model.md)

## Phase 10.1 — Foundation (data layer)

- [X] T001 Baseline: `git status` clean of Phase 10 work; `npm run test:db` green before any change
- [X] T002 Create `supabase/migrations/<ts>_bill_void_audit.sql` (data-model.md; research §1–§5): the `rounds` void overlay (4 columns + the consistency check), `kitchen_tickets.voided`, `void_round` (the validation order, the guarded channel-boundary update, the ticket mirror, the audit), `get_audit_log` (reach rules, filters, clamp), the `get_session_bill` additive extension (items, voided fields, participants, non-voided grand total), grants per contracts §4. Apply with `npm run db:migrate`
- [X] T003 Run `npm run types:gen` — the new signatures land
- [X] T004 Create `tests/database/bill.void.audit.test.ts`: the void matrix (boundary per channel + just-below refusals, blank/501-char reasons verbatim, repeat-void, dan/fiona/anon denials, zero-change proofs per refusal), the audit trail (owner-wide incl. null-branch rows, manager union, cross-branch 42501, carla/dan denied, filters + clamp + ordering), the extended bill (line detail byte-equality, participants, voided exclusion + section keys, additive keys only)
- [X] T005 Full `npm run test:db` regression green; mark the foundation complete

## Phase 10.2 — Client and surfaces (US1/US2/US3)

- [X] T006 [US2] Extend `src/features/staffOps/staffOpsClient.ts` + `useStaffOps.ts`: `voidRound` wrapper (fail-closed payload discipline), `useVoidRound` (invalidate branch reads + bill); the extended `SessionBill`/`BranchRound` types (voided fields, items, participants)
- [X] T007 [US2] Extend `src/features/staffOps/components/RoundCard.tsx` + `src/routes/CashierRoundsPage.tsx` (FR-004): the Void control on boundary states with a reason prompt (non-empty client check as feedback only), the verbatim refusal rendering, the voided display state
- [X] T008 [US1] Extend `src/features/staffOps/components/BillPanel.tsx` (FR-001…FR-003): per-line detail with extras, tax lines by name/amount, the participants list, the voided section with reasons, the payload's grand total
- [X] T009 [US3] Create `src/features/audit/` (`auditClient.ts`, `useAudit.ts`) + `src/routes/AuditLogPage.tsx` (FR-009/FR-010): the filterable newest-first table, role-gated route (owner/branch_manager), the branch filter honoring reach
- [X] T010 Register the audit route + the dashboard nav entry (role-gated); `npx tsc -b` clean

## Phase 10.3 — Browser verification and polish

- [X] T011 [US2] Create `e2e/bill.void.test.ts`: carla locks a real customer round, voids it with a reason from the dashboard, the bill shows the voided section and the reduced grand total; the empty-reason refusal renders verbatim
- [X] T012 [US3] e2e: alice sees the audit trail with the void entry (reason visible); bob is branch-scoped
- [X] T013 Full `npm run verify` + `npm run test:e2e` exit 0; `package.json` unchanged
- [X] T014 Extend `docs/development.md` with the Phase 10 suite table (the void matrix, the audit read) and the "void is an overlay, not a state" rationale
- [X] T015 Reset-and-rebuild determinism: `npm run db:reset -- --yes` → seed → `test:db` green; `types:gen` byte-identical
- [X] T016 Run the quickstart walkthroughs (`scripts/run-billvoid-walkthroughs.mjs`), append the validation record to `quickstart.md`; restore the project afterwards
- [X] T017 Final commit and push of all Phase 10 artifacts to GitHub `main`

## Notes

- Voiding NEVER changes `rounds.state` (research §1) — the cutoff logic is untouched and FR-011 holds by construction
- The bill's grand-total change (voided excluded) is the spec's own FR-003; no prior client depended on voided-inclusive totals
- The audit read is management-level; carla (cashier) is denied by design

## Post-Implement Analysis (2026-09-21)

Contract-vs-deployed verification against the live database:

- Signatures verified: `void_round(uuid, text) → jsonb`, `get_audit_log(text default null, uuid default null, integer default 100) → jsonb`, the additive `get_session_bill` and `get_branch_rounds` (§5) — all match contracts/database-functions.md
- Grants verified via `aclexplode`: both new functions are `authenticated` + owner only — anon/public have no EXECUTE (§4 exact)
- The void overlay columns verified in ordinal position: `voided boolean`, `voided_at timestamptz`, `voided_by_profile_id uuid`, `void_reason text`
- One reconciliation made during implementation: `get_branch_rounds` gained the `voided`/`void_reason`/`voided_at` keys (§5 of the migration) so the cashier card renders the voided display state — additive only, contracts §3 updated to note it
- Both checklists remain reviewer-owned and intentionally unchecked (the 005–010 convention); every `[ ]` item is a reviewer acceptance, not an implementation gap
- Convergence: 17/17 tasks `[X]`, no unchecked implementation work → converged (no convergence section needed)
