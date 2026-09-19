# Quickstart: Tax Engine (Phase 5)

**Feature**: `006-tax-engine` | **Validation record**: appended at the end after the implementation phase runs these walkthroughs (task T037, feature 005's method).

**Prerequisites**: the development project is reset and seeded (`npm run db:reset -- --yes` then `npm run db:seed` — destructive, development only); the seeded fixture provides Blue Olive and Cedar Grill with staff identities (alice owner Blue Olive, bob branch manager Downtown, carla cashier Downtown, dan kitchen, eve owner Cedar Grill and a Downtown cashier) and the demo tax configuration: `VAT` (total, 8.25%, order 1), `City tax` (total, 1.5%, order 2, compound source `VAT`), `Alcohol duty` (categories → Drinks, 10%, order 3), `Imported sweets tax` (items → one Desserts item, 5%, order 4), branch-only `Downtown surcharge` (2%, order 5, Downtown), and a replacement-rate override on `VAT` at Marina (8.75%).

## Walkthrough A — the owner builds the tax configuration (SC-001)

1. Sign in as alice; open `/dashboard/tax`.
2. The seeded rules render in `(sort_order, name)` order with scope badges, rates, and active state; the compound pair shows `City tax` compounding on `VAT`.
3. Create a rule `Regional levy` (total, `0.5`), reorder it to position 1, verify the list and every subsequent calculation apply the new order immediately (FR-015).
4. Edit `VAT`'s rate to `8.5`; verify the effective configuration at Downtown reflects `8.5000` on the next read.
5. Attempt invalid inputs: blank name, duplicate name (`vat` case-insensitive), rate `108`, rate `8.25123`, a category-scoped rule with no targets — each rejected with the contract's message and nothing stored.
6. Retire `Regional levy`; verify it leaves the effective configuration and previews while remaining visible in the owner's list with its retired state.
7. Delete-check: the unused new rule (never applied, unreferenced after retirement) can be deleted; `VAT` cannot — the refusal names the reason: `This tax rule has been applied in recorded results and cannot be deleted.`

## Walkthrough B — the branch journey: overrides and the preview (SC-001, FR-020)

1. As alice, open `/dashboard/branches/<marina-id>/tax`: the effective configuration shows `VAT` with origin `override` at `8.7500`, the other rules at restaurant rates, and `Downtown surcharge` absent (it exists only at Downtown).
2. As bob, open `/dashboard/branches/<downtown-id>/tax`: the controls are present for his own branch; he sets a replacement rate `9.0000` on `VAT` at Downtown — succeeds; he attempts the same at Marina — denied `42501`; he attempts to edit the restaurant-level `VAT` itself — denied.
3. As carla, open Downtown's tax view: the configuration and preview render with **no** controls.
4. The calculation preview: select one Lamb Kebab (base `18.50`) with the paid extra Extra rice (`3.00`) and quantity 2 → subtotal `43.00`; `VAT` at Downtown's effective `9.0000` → line `3.87`; `City tax` compounds on `VAT`'s amount: `43.00 + 3.87 = 46.87 × 1.5% = 0.70305 → 0.70` (half-up); Downtown surcharge `43.00 × 2% = 0.86`; total `48.43` (the Regional levy was retired and deleted in Walkthrough A, so it contributes no line). Repeat the identical submission — byte-identical lines (FR-012).
5. Clear bob's Downtown override: the effective configuration returns to the restaurant default `8.5000` (Walkthrough A step 4) and the preview's VAT line becomes `43.00 × 8.5% = 3.655 → 3.66` (half-up).

## Walkthrough C — isolation, the matrix, snapshots, audit (SC-002…SC-006)

1. As fiona (Marina kitchen — no Blue Olive membership), request Blue Olive's tax configuration or a Blue Olive calculation — denied `42501` through every access path (FR-004). Eve holds a Downtown staff membership by seed (the multi-membership case): she legitimately reads Downtown's configuration and calculation but is denied every write on it.
2. The §16 calculation matrix, spot-checked through the preview and the database suite: no rules (empty config → zero lines); one subtotal tax; multiple taxes; the compound pair; item-level; category-level; mixed scopes; branch overrides; and an ordering change (reorder `City tax` before `VAT` — City's base loses VAT: `18.50 × 1.5% = 0.28`, while VAT has no compound sources and keeps its line; restore the order and the amounts return).
3. Snapshot mechanism proof (data-layer, via the test suite): `record_tax_snapshot` records a produced result once (owner-only); an identical re-record writes nothing and returns the same snapshot id; the recorded payload is immutable; eve cannot record Blue Olive's snapshots. No UI surface in this phase writes snapshots (clarification 3).
4. Audit: every accepted change in Walkthroughs A/B exists as exactly one append-only record with actor, action, resource, change, and tenant scope — branch scope on the override records (FR-021).

## Determinism and rebuild (SC-007)

`npm run db:reset -- --yes && npm run db:seed && npm run test:db` exits 0; `npm run types:gen` output is byte-identical to the committed generated types; the seeded tax configuration is identical after every reset.

---

## Validation record

**Date**: 2026-09-19 · **Method**: programmatic execution against the real development project through the real data APIs (`scripts/run-walkthroughs.mjs`, feature 003/004/005 precedent) · **Result**: **PASS — 34/34 checks** (Walkthrough A 12/12, B 9/9, C 10/10, plus seed-state preconditions).

- **Walkthrough A — the owner builds the tax configuration (SC-001)**: seeded order `VAT → City tax → Alcohol duty → Imported sweets tax → Downtown surcharge` with the compound binding proven (`City tax.compound_sources = [VAT]`); the Regional levy created, reordered to position 1, the order applied to the effective configuration immediately and restored; VAT's rate edit `8.25 → 8.5` reflected on the next read; all five invalid inputs rejected with the contract's verbatim messages and nothing stored; retirement removed the levy from the effective configuration while the owner row remained with `is_active = false`; the unused levy deleted, `VAT`'s deletion refused with `This tax rule has been applied in recorded results and cannot be deleted.`
- **Walkthrough B — the branch journey (SC-001, FR-020)**: Marina's effective config shows `VAT 8.7500, origin=override` with no Downtown surcharge; bob set his own branch's replacement `9.0000`, was denied `42501` at Marina and on the restaurant-level edit; carla read the configuration and was denied every write; the preview produced `subtotal 43.00, VAT 3.87, City tax 0.70 (compound), surcharge 0.86, total 48.43`, byte-identical on repeat (FR-011); clearing the override returned the effective rate to `8.5000` and the VAT line to `3.66` (half-up of 3.655).
- **Walkthrough C — isolation, matrix, snapshots, audit (SC-002…SC-006)**: fiona (no Blue Olive membership) denied the configuration and the calculation with `42501`; eve (Downtown staff by seed) reads Downtown but is denied every write; reordering City before VAT changed exactly City's amount (`0.30 → 0.28`, VAT untouched — it has no compound sources) and the restore returned the fixture; `record_tax_snapshot` recorded once (`recorded: true`), an identical re-record was a no-op returning the same snapshot id, and eve was denied recording; the audit log shows exactly one record per accepted change — `tax.rule_created`, `tax.rule_updated`, `tax.rules_reordered`, `tax.rule_retired`, `tax.rule_deleted`, `tax.branch_override_set`, `tax.branch_override_cleared` — with actor, action, resource, change, and tenant scope (branch scope on the override records, FR-021).
- **Restore**: the walkthroughs mutate the fixture by design (scratch levy, VAT rate, reorders, one snapshot row); the deterministic state is restored with `npm run db:reset -- --yes && npm run db:seed`, after which `npm run test:db` is green again (T034's determinism proof).

**Environment note**: the walkthrough executor (`scripts/run-walkthroughs.mjs`) is committed for repeatability — it signs in the seeded identities, drives the same RPCs the application uses, and prints a step-by-step PASS/FAIL transcript; it pre-cleans artifacts from aborted runs and is rerun-safe.
