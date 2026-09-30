# Feature Checklist: Tax Configuration UX (Phase 08)

Focus: **no client arithmetic (Constitution V)** and **precedence honesty**, per the Master
Plan's checklist directive for this phase. Items are reviewer-owned: `[x]` = the reviewer
confirmed the requirement-quality criterion holds in the delivered surface.

## Frozen tax anchors (re-skin discipline)

- [x] All ~12 tax.surfaces tests pass WITHOUT assertion edits (h1 'Tax'/'Marina tax'/'Downtown
  tax'; 'Add a tax rule'; denial h1s with zero 'Add a tax rule'/'Override' buttons; the
  other-restaurant isolation texts; 'Add an item' + 'Hummus — 6.50'; configured-order preview
  lines; deterministic resubmission; Marina empty state).
- [x] tax.client (477-line unit suite) passes UNCHANGED — existing mapping/parser code untouched.
- [x] New nav/section button names do not collide with any pinned accessible name under strict
  mode (the 027 F3 lesson — check 'Add a tax rule' and 'Override' against section labels).

## No client arithmetic (Constitution V / SC-01)

- [x] The preview computes nothing: amounts, rates, and totals render only from
  `calculate_branch_taxes` output, verbatim (text byte-identical across identical resubmissions).
- [x] No component sums, prorates, or rounds money client-side — the only client math is
  quantity clamping for the payload (existing posture).
- [x] The effective configuration renders only from `get_branch_tax_config` — never assembled
  client-side.
- [x] Money/rate formatting flows through the shared formatters (`formatPrice`/`formatRate`) —
  no local number formatting.

## Precedence honesty (FR-05 / SC-02)

- [x] Inherited vs overridden is text-bearing (badge text), never color-only.
- [x] Badge vocabulary avoids the pinned strings ('Downtown surcharge', '(branch override)') on
  the wrong side — count-0 pins stay green.
- [x] Branch-only rules keep their distinct marker text.
- [x] Override set/clear visibly flips the badge and the effective rate on the invalidated read
  (no optimistic values).

## Explainability (FR-03/FR-04/FR-07/FR-08)

- [x] Compound rules explain 'calculated after' in plain language naming the source rule.
- [x] Ordering control states WHAT the order changes; reorder is keyboard-operable and submits
  the complete list.
- [x] Retire vs delete are visually and textually distinct; delete confirms and names the rule;
  an in-use delete refusal renders verbatim; blast-radius copy states existing sessions keep
  captured money.
- [x] The snapshot action states what it captures (saved configuration — not a preview) and the
  once-only guarantee; `recorded:false` states the outcome without an error.

## Forms / states / a11y

- [x] Rate input labelled with unit + bounds; helper text via `aria-describedby`; rate pattern
  checked before the attempt; server validation messages verbatim next to the field; error
  summary present; input preserved on refusal.
- [x] Scope/target/compound selection is grouped fieldsets.
- [x] Preview busy state replaces the previous result while in flight; the result region
  announces updates (live region); idle/empty-basket/provider-error/payload-error states all
  named surfaces.
- [x] Every write has a busy state; no optimistic writes anywhere.
- [x] <768px: rules + preview readable; simple edits stay; the multi-select pickers are the
  documented boundary (same-DOM note); ordering/badges reachable at 390px.
- [x] Axe WCAG 2.2 AA floor holds on both routes (owner-signed-in scans).

## Discipline

- [x] Database impact NOT_REQUIRED (no migration, no policy change); the only additive data
  code is the thin `recordSnapshot` client mapping + mutation wiring.
- [x] New E2E self-cleans by legal operations (scratch rules retired/removed only where
  unreferenced; per-run suffixes outside all pins; seeded state restored after override
  cycling).
- [x] Prettier on every new/edited file before verify; `impeccable detect src` → 0; colors only
  via tokens (comments included — 027 F5).
- [x] db:reset before verify AND before the full Playwright run (027 F6).
