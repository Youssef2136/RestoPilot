# Tasks: Menu Management UX (Phase 07)

**Spec**: `specs/027-menu-management-ux/spec.md` · **Plan**: `plan.md` · **Checklist**: `checklists/menu-fidelity.md`

| ID | Task | Spec | Done |
| --- | --- | --- | --- |
| T001 | `menu.surfaces.module.css`: management-density styles for rows/thumbnails/filter/nav/pills (022 tokens only) | Visual | [X] |
| T002 | `MenuPage` re-skin: ManagementLayout + SectionCards (#structure, #add-category); frozen h1/intro/selector; loading/error/denial states byte-preserved | FR-01, UX | [X] |
| T003 | `MenuStructurePanel` re-skin: dense MenuItemRow (thumbnail+placeholder, price, pills, extras), CategoryRow reorder/rename/delete (frozen names), delete-consequence messaging, per-category create form preserved | FR-01/02, Q2 | [X] |
| T004 | `MenuFilter` (search box, per-category narrowing, filtered-empty states) | FR-02 | [X] |
| T005 | `MenuItemEditor` + `ExtrasEditor` + `ItemImageField` re-skin on Field/Input primitives; image placeholder language; frozen labels/regions; limits-before-attempt | FR-03, Q4 | [X] |
| T006 | `BranchMenuPage` re-skin: SectionCards (preview / branch availability / restaurant-wide) + ScopeBadge; preview + toggle copy byte-preserved; realtime dual-key invalidation | FR-04/05/06/09, Q5 | [X] |
| T007 | State-matrix sweep: empty/loading/error/refusal states across both routes per the state matrix | FR-08, States | [X] |
| T008 | New E2E `e2e/menu.management.test.ts`: owner scratch journey (create/edit/extras/image/stop + legal cleanup), search/filter, empty-delete refusal verbatim, realtime no-refresh effect, 390px fallback, axe | Gates | [X] |
| T009 | Evidence screenshots (structure view, item editor, branch menu page, mobile row) + ledger §Phase 027 | FINISH | [X] |
| T010 | Validation: db:reset → `npm run verify` → full `test:e2e`; `impeccable detect src` 0; convergence fixes | Gates | [X] |
| T011 | Checkpoint `feat(027)` + push (auto-push rule); report + state DONE | CHECKPOINT/REPORT | [X] |
