-- Tax rate precision: widen the rate columns from numeric(5,4) to
-- numeric(7,4) (spec 006 FR-007; research.md §1 — corrected during
-- implementation by the seed's own fixture: numeric(5,4) caps at 9.9999 and
-- cannot represent a 10% rate, let alone the documented 100% maximum).
--
-- numeric(7,4) carries every rate the contract allows: four decimal places
-- and the full 0–100 range (100.0000 included). The 0–100 checks are
-- unchanged; no stored value is affected (the columns are empty or hold
-- values ≤ 9.9999). Added as a NEW migration — applied migrations are never
-- edited (FR-024); the data-model.md and research.md §1 documents are
-- corrected to match in the same change.

alter table public.tax_rules alter column rate type numeric(7, 4);
alter table public.branch_tax_overrides alter column rate type numeric(7, 4);
