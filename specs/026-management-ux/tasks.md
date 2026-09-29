# Tasks: Restaurant, Branch, Tables & Staff Management UX (Phase 06)

**Spec**: `specs/026-management-ux/spec.md` · **Plan**: `plan.md` · **Checklist**: `checklists/management-fidelity.md`

| ID | Task | Spec | Done |
| --- | --- | --- | --- |
| T001 | Shared management layer: `ManagementLayout` (section nav + fragments), `SectionCard`, `StatusPill`, `BranchHeader` + module css (022 tokens; nav collapses <1024px) | FR-01/06, Visual, Q1 | [x] |
| T002 | `ManageRestaurantPage` re-skin: Profile/Settings/QR into SectionCards under the section nav; identifier flow + forms untouched; QR card guidance | FR-01, FR-04, Q5 | [x] |
| T003 | `BranchesPage` re-skin: status pills, create form preserved, empty state with CTA | FR-02, FR-09 | [x] |
| T004 | `BranchDetailPage` re-skin: BranchHeader + sections (Hours/Tables/Sessions entry) with ScopeBadge read-only hints for scoped members; WorkingHoursEditor re-hosted (labels byte-identical); tables rows keep listitem + exact toggle names | FR-02/03/06/10, Q3/Q4 | [x] |
| T005 | `StaffListPage` re-skin: StaffTable (`th scope`, role/branch/status), CredentialReveal layout per Q2, removal via ConfirmDialog with consequence wording, last-owner refusal verbatim | FR-05, FR-08/09 | [x] |
| T006 | Empty/busy/refusal states sweep across the four routes per the state matrix | FR-08/09 | [x] |
| T007 | New E2E `e2e/management.staff.test.ts`: provisioning scratch identity → credential reveal/copy/dismissal → removal consequence dialog → last-owner refusal; section fragments; Bob read-only hints; 390px card fallback; self-cleaning | Gates, FR-05/10 | [x] |
| T008 | Evidence screenshots (restaurant sections, branch detail, staff list, credential reveal) + ledger §Phase 026 | FINISH | [x] |
| T009 | Validation: `npm run verify` + `test:db` green unchanged + full `test:e2e`; `impeccable detect src` 0; convergence fixes | Gates | [x] |
| T010 | Checkpoint `feat(026)` + push (auto-push rule); report + state DONE | CHECKPOINT/REPORT | [x] |
