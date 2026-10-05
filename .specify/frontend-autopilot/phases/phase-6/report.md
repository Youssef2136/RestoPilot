# Phase 06 Report — Restaurant, Branch, Tables & Staff Management UX

**Status: DONE · CONVERGED (1 convergence round) · 2026-09-29**
**Spec:** `specs/026-management-ux` · **Baseline:** `2cdbe11` (phase 05)

## Objective

Turn the management configuration surfaces into navigable management screens — restaurant
identity, branches, tables, working hours, the QR entry point, staff provisioning — with the
management layout language (section nav, section cards, status pills, scope badges), without
moving any frozen management anchor.

## Requirements → implementation → validation

| Requirement | Implementation | Validation |
| --- | --- | --- |
| FR-01 profile/settings + identifier flow | SectionCards under ManagementLayout; the warning flow untouched | management.surfaces 3/3 (restaurant subset) |
| FR-02 branches + hours editor | BranchesPage list kept; hours editor re-hosted, labels byte-identical | management.surfaces branch subset 4/4 |
| FR-03 tables management | listitem rows + StatusPill ('Active'/'Inactive') + exact toggle names | owner + non-owner tests |
| FR-04 QR panel | print-oriented card ('Owner controls' badge + guidance); SVG/PNG untouched | QR tests 2/2 |
| FR-05 staff provisioning | CredentialReveal layout kept; removal via ConfirmDialog with consequence; last-owner verbatim | management.staff 5/5 |
| FR-06 branch detail | BranchHeader + sections + sessions hand-off link | branch tests |
| FR-07 out-of-scope denial | untouched; re-verified | denial h1 tests |
| FR-08 busy/refusals | client layer untouched (verbatim surfacing preserved) | unit suites green UNCHANGED |
| FR-09 empty states | branches/tables/staff/hours texts kept + CTAs | full run |
| FR-10 scope clarity | ScopeBadge 'Owner controls'/'Read-only' per section | management.staff (badge count 2, zero controls for Bob) |
| Q1 fragments | section nav reflects `#profile/#settings/#qr` | management.staff fragment test |

## Files changed

**New:** `src/components/management/{ManagementLayout,SectionCard,ScopeBadge,StatusPill,BranchHeader}.tsx` + `management.module.css`, `src/routes/{BranchDetailPage,StaffListPage}.module.css`, `e2e/management.staff.test.ts`, evidence ×4 PNGs.
**Modified:** `ManageRestaurantPage.tsx`, `BranchDetailPage.tsx`, `StaffListPage.tsx`, `docs/frontend-presentation-contracts.md`, spec artifacts.

## Backend contracts used

NOT_REQUIRED — the management RPC set, policy-scoped reads, and `get_branch_open_sessions`
consumed as-is; `managementClient.ts`/`workingHours.ts`/`qrEntry.ts` untouched.

## Design / Impeccable

`impeccable detect src`: **0 anti-patterns**. Evidence: `specs/026-management-ux/evidence/`
(restaurant sections, branch detail, staff list, credential reveal). Layout language from 022
tokens only; density distinct from the customer surfaces, same primitives.

## Validation results

`npm run verify` **PASS** (prettier, eslint, tsc, **unit 369/369**, **db 516/516** on clean reset, **integration 38/38**, build 752.10 kB / gzip 207.14 kB) + `npm run test:e2e` **161/161 — 0 failed** (9.6 min) + impeccable 0. `management.surfaces` 13/13 and `full-journey` 3/3 passed WITHOUT assertion edits.

## Fixes & convergence

1 round (management.staff 1/5 → 5/5): clipboard permission grant (F4); residue-aware design —
unique per-run names + bounded pre-cleanup (F2); verbatim-string assertions corrected by reading
failure contexts (F3). Incident: verify db gate needed a clean reset after E2E (F5 carried).

## Git checkpoint

`feat(026)` on `main` (baseline `2cdbe11`), pushed to origin per the standing auto-push rule.
Untracked-by-design leftovers unchanged.

## Remaining warnings

- R2 (carried): Impeccable launcher detect-only.
- verify's db gate requires a fresh reset after heavy E2E (F5, re-proved).

## Traceability

Spec FR-01…FR-10 → files above → management.staff (new) + management.surfaces/full-journey
(frozen pins, unedited); layout contracts recorded in `docs/frontend-presentation-contracts.md`
§"Phase 026 presentation record".
